// Copyright (c) 2026 孟凡皓 (cn.bj). All rights reserved.
// Desktop pet interaction layer:
// - endless idle/action chain (breathing, stretching, hopping, turning, dozing…)
// - click response with squash & stretch and particles
// - spring-follow drag + throw with gravity, edge bounce, ground friction and landing squash
// - screen wandering with facing and soft screen bounds
// - native right-click menu actions (polled via Tauri)
// All motion is applied to the transparent window position; the sprite stays centered.

(function () {
  'use strict';

  // ---------- DOM ----------
  var petStage = document.getElementById('pet-stage');
  var petImage = document.getElementById('pet-image');
  var particleLayer = document.getElementById('particle-layer');
  var heartsLayer = document.getElementById('hearts-layer');
  var stickerLayer = document.getElementById('sticker-layer');

  // ---------- constants ----------
  var IDLE_TIMEOUT = 30000;
  var PET_COOLDOWN = 1500;
  var DRAG_THRESHOLD = 5;
  var CHAIN_MIN_MS = 4200;
  var CHAIN_RANDOM_MS = 4200;
  var DEFAULT_PET_SIZE = 256;

  var ONE_SHOT = {
    happy: 1000,
    shy: 1300,
    angry: 900,
    surprised: 900,
    eating: 1400,
    stretch: 1600,
    hop: 1100,
    spin: 1200,
    shake: 900,
    look: 1400,
    wave: 1200,
    doze: 2400
  };
  var RANDOM_POOL = ['stretch', 'hop', 'spin', 'shake', 'look', 'wave', 'doze'];
  var CLICK_POOL = ['happy', 'eating', 'shy', 'surprised', 'angry'];

  // Image-based effect sprites. Emoji glyphs render differently on every OS
  // (and look out of place on a transparent window), so all reactions use
  // bundled SVG artwork instead.
  var EFFECTS = {
    hearts: [
      'assets/effects/heart-pink.svg',
      'assets/effects/heart-coral.svg',
      'assets/effects/heart-red.svg'
    ],
    sparkles: [
      'assets/effects/sparkle-gold.svg',
      'assets/effects/sparkle-white.svg'
    ],
    notes: ['assets/effects/note-purple.svg'],
    anger: ['assets/effects/anger.svg'],
    steam: ['assets/effects/steam.svg'],
    redSparks: ['assets/effects/spark-red.svg'],
    exclaim: ['assets/effects/exclaim.svg'],
    food: [
      'assets/effects/fish.svg',
      'assets/effects/cookie.svg',
      'assets/effects/candy.svg'
    ],
    zzz: ['assets/effects/zzz.svg']
  };

  // Reaction stickers: a small image bubble parked in the top-right corner so
  // it never covers the pet's face.
  var STICKERS = {
    pet: 'assets/memes/pet.png',
    happy: 'assets/memes/happy.png',
    shy: 'assets/memes/shy.png',
    angry: 'assets/memes/angry.png',
    surprised: 'assets/memes/surprised.png',
    eating: 'assets/memes/eating.png',
    sleepy: 'assets/memes/sleepy.png'
  };
  var STICKER_CAPTIONS = {
    pet: '贴贴',
    happy: '好耶',
    shy: '害羞',
    angry: '哼！',
    surprised: '诶？！',
    eating: '干饭',
    sleepy: '困了'
  };
  var CLICK_STICKER = {
    happy: 'happy',
    shy: 'shy',
    angry: 'angry',
    surprised: 'surprised',
    eating: 'eating'
  };
  var STICKER_MS = 1950;

  // ---------- state ----------
  var facing = 'right';
  var animState = 'idle';
  var sleeping = false;
  var thinkingActive = false;
  var wandering = false;
  var moving = false;
  var throwing = false;

  var runtime = {
    pet_size: DEFAULT_PET_SIZE,
    random_actions_enabled: true,
    wander_enabled: true,
    throw_power: 1,
    bounce: 0.78
  };
  var physics = PetPhysics.DEFAULT_PHYSICS();

  var currentImageVersion = null;
  var currentImageUrl = '';
  var screenGeom = null;
  var geometryReady = false;
  var winPos = { x: 0, y: 0 };

  var drag = newDrag();
  var springRaf = null;
  var throwRaf = null;
  var throwToken = 0;
  var moveRaf = null;
  var wanderRaf = null;
  var actionTimer = null;
  var chainTimer = null;
  var idleTimer = null;
  var zzzTimer = null;
  var lastPetTime = 0;
  var squash = { raf: null, token: 0 };

  // Landmark "paper doll" rig built from the still pet image. It replaces the
  // flat sprite once MediaPipe has located the character's body, so reactions
  // move the head and arms instead of just squashing a rectangle.
  var rig = null;
  var rigBuildTimer = null;
  var rigPendingSrc = null;
  var rigFailedSrc = null;
  var imageSerial = 0;
  var stickerTimer = null;

  function newDrag() {
    return {
      active: false,
      dragging: false,
      pointerId: null,
      // `clientX/Y` are relative to the webview, which WKWebView reports
      // reliably (unlike `screenX/Y`, which is broken for this borderless
      // window). We reconstruct the global cursor by adding the window's
      // movement between events; the errors from the one-frame window lag
      // cancel out instead of accumulating.
      startClient: { x: 0, y: 0 },
      lastClient: { x: 0, y: 0 },
      lastWin: { x: 0, y: 0 },
      cursorPos: { x: 0, y: 0 },
      startCursor: { x: 0, y: 0 },
      startWin: { x: 0, y: 0 },
      target: { x: 0, y: 0 },
      trail: []
    };
  }

  function isBusy() {
    return drag.active || springRaf !== null || throwRaf !== null || throwing || wandering || moving;
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // ---------- init ----------
  function init() {
    if (!petStage || !petImage) return;

    updateStageTransform();
    setAnim('idle');
    preloadEffects();
    preloadStickers();
    bindEvents();

    refreshRuntime(true);
    syncWindow().then(refreshScreenGeometry);
    resetIdleTimer();    scheduleNextAction(CHAIN_MIN_MS + Math.random() * CHAIN_RANDOM_MS);

    setInterval(refreshRuntime, 1000);
    setInterval(pollCommand, 120);
    setInterval(function () {
      if (!isBusy() && !sleeping) syncWindow();
    }, 2000);
  }

  // ---------- IPC helpers ----------
  function applyRuntime(rt, force) {
    if (rt) {
      var wasActive = runtime.random_actions_enabled;
      runtime.pet_size = rt.pet_size || runtime.pet_size;
      runtime.random_actions_enabled = rt.random_actions_enabled !== false;
      runtime.wander_enabled = rt.wander_enabled !== false;
      runtime.throw_power = (typeof rt.throw_power === 'number' && rt.throw_power > 0) ? rt.throw_power : 1;
      runtime.bounce = (typeof rt.bounce === 'number' && rt.bounce > 0) ? rt.bounce : 0.78;

      physics.throwPower = runtime.throw_power;
      physics.restitution = runtime.bounce;

      if (!runtime.random_actions_enabled) {
        clearChainTimer();
      } else if (!wasActive && !isBusy() && !sleeping && actionTimer === null) {
        scheduleNextAction();
      }

      var versionChanged = force || rt.image_version !== currentImageVersion;
      currentImageVersion = rt.image_version;
      if (versionChanged) loadPetImage();
    } else if (force) {
      loadPetImage();
    }
  }

  function refreshRuntime(force) {
    return invoke('get_pet_runtime_state').then(function (rt) {
      if (rt) applyRuntime(rt, !!force);
    }).catch(function () {});
  }

  function loadPetImage() {
    return invoke('load_pet_image_url').then(function (dataUrl) {
      var src = dataUrl || 'assets/default-pet.svg';
      if (src !== currentImageUrl) {
        currentImageUrl = src;
        imageSerial++;
        resetRig();
        petImage.src = src;
      }
      maybeBuildRig(src, imageSerial);
    }).catch(function () {});
  }

  // ---------- landmark rig ----------
  function resetRig() {
    if (rigBuildTimer) {
      clearTimeout(rigBuildTimer);
      rigBuildTimer = null;
    }
    rigPendingSrc = null;
    rigFailedSrc = null;
    if (rig) {
      if (rig._ro) {
        rig._ro.disconnect();
        rig._ro = null;
      }
      if (rig.el && rig.el.parentNode) rig.el.parentNode.removeChild(rig.el);
      if (typeof rig.destroy === 'function') rig.destroy();
      rig = null;
    }
    if (petImage) petImage.classList.remove('rig-hidden');
  }

  function isRigEligible(src) {
    if (!src || src === 'assets/default-pet.svg') return false;
    // Animated GIFs have no stable pose; keep the flat path for them.
    if (/^data:image\/gif/i.test(src) || /\.gif(?:[?#]|$)/i.test(src)) return false;
    return !!(window.PetRig && window.PetRig.isAvailable && window.PetRig.isAvailable());
  }

  function maybeBuildRig(src, serial) {
    if (!isRigEligible(src)) return;
    if (rig || rigPendingSrc === src || rigFailedSrc === src) return;

    rigPendingSrc = src;
    // Give the flat sprite a moment to paint first: building the rig takes a
    // few hundred ms and the image can arrive during startup.
    rigBuildTimer = setTimeout(function () {
      rigBuildTimer = null;
      PetRig.create(src).then(function (handle) {
        if (serial !== imageSerial || currentImageUrl !== src) {
          if (handle && typeof handle.destroy === 'function') handle.destroy();
          return;
        }
        rigPendingSrc = null;
        mountRig(handle);
      }).catch(function () {
        // Deliberately silent: a photo without a detectable standing figure
        // simply keeps the flat sprite. Remember the failure so a 1s runtime
        // poll doesn't re-run the model forever.
        if (serial === imageSerial) {
          rigPendingSrc = null;
          rigFailedSrc = src;
        }
      });
    }, 280);
  }

  function mountRig(handle) {
    if (!handle || !handle.el) return;
    if (rig) resetRig();
    rig = handle;
    petStage.appendChild(handle.el);
    handle.layout();
    handle.setAnim(animState);
    handle.el.classList.add('rig-ready');
    petImage.classList.add('rig-hidden');
    // The stage may still be settling right after a window/image resize.
    // A ResizeObserver keeps the rig fitted if the window size lands later.
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () {
        if (rig === handle) handle.layout();
      });
      ro.observe(petStage);
      handle._ro = ro;
    }
    window.setTimeout(function () {
      if (rig === handle) handle.layout();
    }, 90);
  }

  function syncWindow() {
    return invoke('get_window_geometry').then(function (g) {
      if (g) {
        geometryReady = true;
        if (!isBusy()) {
          winPos.x = g.x;
          winPos.y = g.y;
        }
      }
    }).catch(function () {});
  }

  function refreshScreenGeometry() {
    return invoke('get_screen_geometry').then(function (g) {
      if (g) screenGeom = g;
    }).catch(function () {});
  }

  function setWinPos(x, y) {
    winPos.x = x;
    winPos.y = y;
    if (isTauri) {
      invoke('set_window_position', { x: x, y: y }).catch(function () {});
    }
  }

  function persistPosition() {
    invoke('persist_window_position').catch(function () {});
  }

  // ---------- animation state ----------
  function setAnim(name) {
    animState = name;
    petImage.className = '';
    void petImage.offsetWidth; // restart CSS animation
    petImage.classList.add(name);
    if (rig) {
      // setAnim() clears the sprite's classes, so restore the hiding class and
      // drive the segmented parts with the same state name.
      petImage.classList.add('rig-hidden');
      rig.setAnim(name);
    }
  }

  function clearActionTimer() {
    if (actionTimer !== null) {
      clearTimeout(actionTimer);
      actionTimer = null;
    }
    // If an interrupted turn was mid-flight, commit its visual target now.
    if (petStage.classList.contains('turning-left') || petStage.classList.contains('turning-right')) {
      facing = petStage.classList.contains('turning-left') ? 'left' : 'right';
      petStage.classList.remove('turning-left', 'turning-right');
      updateStageTransform();
    }
  }

  function clearChainTimer() {
    if (chainTimer !== null) {
      clearTimeout(chainTimer);
      chainTimer = null;
    }
  }

  function playOneShot(name, origin) {
    if (!ONE_SHOT[name]) return;
    wakeUp();
    clearActionTimer();
    clearChainTimer();
    setAnim(name);

    if (name === 'doze') spawnZzz();
    if (name === 'happy' || name === 'shy') spawnHearts(origin);
    if (name === 'eating') spawnFoodParticles(origin);
    if (name === 'angry') spawnAnger(origin);
    if (name === 'surprised') spawnSurprise(origin);

    actionTimer = setTimeout(function () {
      actionTimer = null;
      if (!isBusy() && !sleeping) returnToIdle();
    }, ONE_SHOT[name]);
  }

  function returnToIdle() {
    if (isBusy() || sleeping) return;
    clearActionTimer();
    setAnim(idleName());
    resetIdleTimer();
    scheduleNextAction();
  }

  function idleName() {
    return 'idle';
  }

  function scheduleNextAction(delay) {
    clearChainTimer();
    if (!runtime.random_actions_enabled || sleeping) return;
    var wait = typeof delay === 'number' ? delay : CHAIN_MIN_MS + Math.random() * CHAIN_RANDOM_MS;
    chainTimer = setTimeout(pickChainAction, wait);
  }

  function pickChainAction() {
    chainTimer = null;
    if (isBusy() || sleeping || !runtime.random_actions_enabled) return;

    var roll = Math.random();
    if (roll < 0.1) {
      doTurn();
      return;
    }
    if (roll < 0.26 && runtime.wander_enabled) {
      if (startWander()) return;
    }
    playOneShot(RANDOM_POOL[Math.floor(Math.random() * RANDOM_POOL.length)]);
  }

  function doTurn() {
    if (isBusy() || sleeping) return;
    wakeUp();
    clearActionTimer();
    clearChainTimer();

    var next = facing === 'left' ? 'right' : 'left';
    petStage.classList.remove('turning-left', 'turning-right');
    void petStage.offsetWidth;
    petStage.classList.add(next === 'left' ? 'turning-left' : 'turning-right');

    actionTimer = setTimeout(function () {
      actionTimer = null;
      facing = next;
      petStage.classList.remove('turning-left', 'turning-right');
      updateStageTransform();
      if (!isBusy() && !sleeping) returnToIdle();
    }, 900);
  }

  function setFacing(next) {
    facing = next;
    updateStageTransform();
  }

  function updateStageTransform() {
    if (!petStage) return;
    petStage.style.transformOrigin = 'center bottom';
    petStage.style.transform = 'scaleX(' + (facing === 'left' ? -1 : 1) + ')';
  }

  function startSquash(depth) {
    if (reducedMotion() || drag.active) return;
    if (petStage.classList.contains('turning-left') || petStage.classList.contains('turning-right')) return;

    var token = ++squash.token;
    if (squash.raf !== null) cancelAnimationFrame(squash.raf);
    var t0 = performance.now();
    var face = facing === 'left' ? -1 : 1;

    function step() {
      if (token !== squash.token) return;
      var u = Math.min((performance.now() - t0) / PetPhysics.SQ_DURATION_MS, 1);
      var scale = PetPhysics.squashScale(u, depth);
      petStage.style.transform = 'scaleX(' + face + ') scaleY(' + scale + ')';
      if (u < 1) {
        squash.raf = requestAnimationFrame(step);
      } else {
        squash.raf = null;
        updateStageTransform();
      }
    }
    squash.raf = requestAnimationFrame(step);
  }

  // ---------- idle / sleep ----------
  function resetIdleTimer() {
    if (idleTimer !== null) clearTimeout(idleTimer);
    idleTimer = null;
    if (sleeping) return;
    idleTimer = setTimeout(idleCheck, IDLE_TIMEOUT);
  }

  function idleCheck() {
    idleTimer = null;
    if (sleeping) return;
    if (thinkingActive) {
      idleTimer = setTimeout(idleCheck, 5000);
      return;
    }
    if (!isBusy() && actionTimer === null) {
      goToSleep();
      return;
    }
    // An action or user interaction was in flight; check again shortly.
    idleTimer = setTimeout(idleCheck, 5000);
  }

  function goToSleep() {
    if (isBusy() || sleeping || thinkingActive) return;
    sleeping = true;
    clearActionTimer();
    clearChainTimer();
    setAnim('sleeping');
    showSticker('sleepy');
    spawnZzz();
    if (zzzTimer !== null) clearInterval(zzzTimer);
    zzzTimer = setInterval(spawnZzz, 1900);
  }

  function wakeUp() {
    if (!sleeping) return;
    sleeping = false;
    if (zzzTimer !== null) {
      clearInterval(zzzTimer);
      zzzTimer = null;
    }
    if (!isBusy()) {
      setAnim('idle');
      scheduleNextAction();
    }
    resetIdleTimer();
  }

  // ---------- drag / throw ----------
  function onPointerDown(e) {
    if (e.button !== 0) return;
    if (e.target && e.target.closest && e.target.closest('#mic-toggle')) return;
    // The window position must be known before drag deltas can be reconstructed.
    if (!geometryReady) {
      syncWindow();
      return;
    }

    wakeUp();
    clearActionTimer();
    clearChainTimer();
    stopWander();
    stopMove();
    stopThrow();
    stopSpring();

    dragging_start(e);
    e.preventDefault();
  }

  function dragging_start(e) {
    drag = newDrag();
    drag.active = true;
    drag.pointerId = e.pointerId;
    drag.startClient.x = e.clientX;
    drag.startClient.y = e.clientY;
    drag.lastClient.x = e.clientX;
    drag.lastClient.y = e.clientY;
    drag.lastWin.x = winPos.x;
    drag.lastWin.y = winPos.y;
    drag.startWin.x = winPos.x;
    drag.startWin.y = winPos.y;
    drag.cursorPos.x = winPos.x + e.clientX;
    drag.cursorPos.y = winPos.y + e.clientY;
    drag.startCursor.x = drag.cursorPos.x;
    drag.startCursor.y = drag.cursorPos.y;
    drag.target.x = winPos.x;
    drag.target.y = winPos.y;
    drag.trail.push({ t: performance.now(), x: drag.cursorPos.x, y: drag.cursorPos.y });

    try {
      if (petImage.setPointerCapture) petImage.setPointerCapture(e.pointerId);
    } catch (err) { /* ignore */ }
  }

  function onPointerMove(e) {
    if (drag.active) {
      // Reconstruct global cursor movement from viewport-relative movement
      // plus the movement of our own window between events.
      var dcx = e.clientX - drag.lastClient.x;
      var dcy = e.clientY - drag.lastClient.y;
      var dwx = winPos.x - drag.lastWin.x;
      var dwy = winPos.y - drag.lastWin.y;
      drag.cursorPos.x += dcx + dwx;
      drag.cursorPos.y += dcy + dwy;
      drag.lastClient.x = e.clientX;
      drag.lastClient.y = e.clientY;
      drag.lastWin.x = winPos.x;
      drag.lastWin.y = winPos.y;

      if (!drag.dragging) {
        var startDx = e.clientX - drag.startClient.x;
        var startDy = e.clientY - drag.startClient.y;
        if (Math.hypot(startDx, startDy) > DRAG_THRESHOLD) {
          drag.dragging = true;
          setAnim('held');
        }
      }

      if (drag.dragging) {
        var now = performance.now();
        drag.trail.push({ t: now, x: drag.cursorPos.x, y: drag.cursorPos.y });
        drag.trail = PetPhysics.trimTrail(drag.trail, now);
        drag.target.x = drag.startWin.x + (drag.cursorPos.x - drag.startCursor.x);
        drag.target.y = drag.startWin.y + (drag.cursorPos.y - drag.startCursor.y);
        startSpringFollow();
        e.preventDefault();
      }
      return;
    }

    // hover petting: only the top third of the sprite, with a cooldown
    if (e.buttons === 0) {
      resetIdleTimer();
      if (sleeping) wakeUp();
      var now2 = Date.now();
      if (now2 - lastPetTime > PET_COOLDOWN && actionTimer === null && !isBusy()) {
        var rect = petImage.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 3) {
          lastPetTime = now2;
          triggerPetting(e);
        }
      }
    }
  }

  function onPointerUp(e) {
    if (!drag.active) return;

    var wasDragging = drag.dragging;
    var trail = drag.trail.slice();
    drag.active = false;
    drag.dragging = false;
    stopSpring();

    try {
      if (petImage.releasePointerCapture && drag.pointerId !== null) {
        petImage.releasePointerCapture(drag.pointerId);
      }
    } catch (err) { /* ignore */ }

    if (wasDragging) {
      var vel = PetPhysics.estimateReleaseVelocity(trail, performance.now(), physics);
      if (vel) {
        startThrow(vel.vx, vel.vy);
      } else {
        persistPosition();
        returnToIdle();
      }
    } else {
      triggerClickResponse(e);
    }
  }

  function onPointerCancel() {
    if (!drag.active) return;
    drag.active = false;
    drag.dragging = false;
    stopSpring();
    persistPosition();
    returnToIdle();
  }

  function startSpringFollow() {
    if (springRaf !== null) return;
    var last = performance.now();
    var vel = { vx: 0, vy: 0 };

    function step() {
      if (!drag.active || !drag.dragging) {
        springRaf = null;
        return;
      }
      var now = performance.now();
      var dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      if (dt <= 0) {
        springRaf = requestAnimationFrame(step);
        return;
      }
      vel.vx = PetPhysics.springStep(vel.vx, winPos.x, drag.target.x, dt, physics.throwPower);
      vel.vy = PetPhysics.springStep(vel.vy, winPos.y, drag.target.y, dt, physics.throwPower);
      setWinPos(winPos.x + vel.vx * dt, winPos.y + vel.vy * dt);
      springRaf = requestAnimationFrame(step);
    }
    springRaf = requestAnimationFrame(step);
  }

  function stopSpring() {
    if (springRaf !== null) {
      cancelAnimationFrame(springRaf);
      springRaf = null;
    }
  }

  function startThrow(vx, vy) {
    stopWander();
    stopMove();
    stopSpring();
    stopThrow();
    var token = throwToken;
    throwing = true;
    setAnim('held');

    var ready = isTauri
      ? invoke('get_screen_geometry').catch(function () { return null; })
      : Promise.resolve(null);

    ready.then(function (geom) {
      if (token !== throwToken) return;
      if (geom) screenGeom = geom;
      if (!screenGeom) {
        throwing = false;
        returnToIdle();
        return;
      }

      var b = PetPhysics.boundsFromScreen(screenGeom, window.innerWidth, window.innerHeight);
      var st = { x: winPos.x, y: winPos.y, vx: vx, vy: vy };
      var last = performance.now();
      var prevGrounded = false;

      function step() {
        if (token !== throwToken) {
          throwRaf = null;
          return;
        }
        var now = performance.now();
        var dt = (now - last) / 1000;
        last = now;
        var fallingVy = st.vy;

        var res = PetPhysics.throwStep(st, dt, b, physics);
        st.x = res.x;
        st.y = res.y;
        st.vx = res.vx;
        st.vy = res.vy;
        setWinPos(st.x, st.y);

        var grounded = st.y >= b.maxY - 1;
        if (res.bounced && grounded && !prevGrounded) {
          startSquash(PetPhysics.landingSquash(fallingVy));
        }
        prevGrounded = grounded;

        if (res.atRest) {
          throwRaf = null;
          throwing = false;
          setAnim('idle');
          persistPosition();
          returnToIdle();
          return;
        }
        throwRaf = requestAnimationFrame(step);
      }
      throwRaf = requestAnimationFrame(step);
    });
  }

  function stopThrow() {
    throwToken++;
    if (throwRaf !== null) {
      cancelAnimationFrame(throwRaf);
      throwRaf = null;
    }
    throwing = false;
  }

  // ---------- screen wandering ----------
  function startWander() {
    if (isBusy() || sleeping || !runtime.wander_enabled || !screenGeom || !isTauri) return false;

    var b = PetPhysics.boundsFromScreen(screenGeom, window.innerWidth, window.innerHeight);
    var margin = 16;
    var sizeScale = Math.max(0.5, (runtime.pet_size || window.innerWidth || DEFAULT_PET_SIZE) / DEFAULT_PET_SIZE);
    var dist = (80 + Math.random() * 200) * sizeScale;
    var dir = facing === 'left' ? -1 : 1;

    if (dir < 0 && winPos.x - dist < b.minX + margin) dir = 1;
    else if (dir > 0 && winPos.x + dist > b.maxX - margin) dir = -1;

    var lo = b.minX + margin;
    var hi = Math.max(lo, b.maxX - margin);
    var targetX = Math.min(Math.max(winPos.x + dir * dist, lo), hi);
    if (Math.abs(targetX - winPos.x) < 20) return false;

    clearActionTimer();
    clearChainTimer();
    wandering = true;
    setFacing(dir > 0 ? 'right' : 'left');
    setAnim('walk');

    var startX = winPos.x;
    var startY = winPos.y;
    var distance = Math.abs(targetX - startX);
    var duration = 700 + (distance / 80) * 1000;
    var t0 = performance.now();

    function step() {
      var p = Math.min((performance.now() - t0) / duration, 1);
      // stationary lead-in/out, constant travel in the middle
      var q = Math.min(Math.max((p - 0.15) / 0.7, 0), 1);
      setWinPos(startX + (targetX - startX) * q, startY);
      if (p < 1) {
        wanderRaf = requestAnimationFrame(step);
      } else {
        wanderRaf = null;
        wandering = false;
        persistPosition();
        returnToIdle();
      }
    }
    wanderRaf = requestAnimationFrame(step);
    return true;
  }

  function stopWander() {
    if (wanderRaf !== null) {
      cancelAnimationFrame(wanderRaf);
      wanderRaf = null;
    }
    wandering = false;
  }

  // ---------- home ----------
  function goHome() {
    if (!isTauri) return;
    var run = function () {
      stopWander();
      stopThrow();
      stopSpring();
      clearActionTimer();
      clearChainTimer();

      var b = PetPhysics.boundsFromScreen(screenGeom, window.innerWidth, window.innerHeight);
      var margin = 24;
      var tx = Math.max(b.minX, b.maxX - margin);
      var ty = Math.max(b.minY, b.maxY - margin);
      moveWindowTo(tx, ty, 900, function () {
        persistPosition();
        returnToIdle();
      });
    };
    if (screenGeom) run();
    else refreshScreenGeometry().then(run);
  }

  function stopMove() {
    if (moveRaf !== null) {
      cancelAnimationFrame(moveRaf);
      moveRaf = null;
    }
    moving = false;
  }

  function moveWindowTo(tx, ty, duration, done) {
    stopMove();
    var sx = winPos.x;
    var sy = winPos.y;
    var t0 = performance.now();
    moving = true;
    setAnim('walk');

    function step() {
      var p = Math.min((performance.now() - t0) / duration, 1);
      var eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      setWinPos(sx + (tx - sx) * eased, sy + (ty - sy) * eased);
      if (p < 1) {
        moveRaf = requestAnimationFrame(step);
      } else {
        moveRaf = null;
        moving = false;
        setAnim('idle');
        if (done) done();
      }
    }
    moveRaf = requestAnimationFrame(step);
  }

  // ---------- click responses ----------
  function triggerClickResponse(e, force) {
    wakeUp();
    var name = force || CLICK_POOL[Math.floor(Math.random() * CLICK_POOL.length)];
    if (e && typeof e.clientX === 'number') {
      spawnTouchRipple(e.clientX, e.clientY, true);
    }
    playOneShot(name, eventOrigin(e));
    if (CLICK_STICKER[name]) showSticker(CLICK_STICKER[name]);
    // The rig already animates the body/limbs; keep only a light impact
    // bounce instead of the flat sprite's strong whole-image squash.
    startSquash(rig ? 0.86 : PetPhysics.SQ_SQUASH);
    resetIdleTimer();
  }

  function triggerPetting(e) {
    if (e && typeof e.clientX === 'number') {
      spawnTouchRipple(e.clientX, e.clientY, false);
    }
    playOneShot('happy', eventOrigin(e));
    showSticker('pet');
    startSquash(rig ? 0.89 : 0.72);
  }

  // ---------- image particles ----------
  function particleOrigin() {
    var rect = petImage.getBoundingClientRect();
    return { x: rect.width * 0.5, y: rect.height * 0.35 };
  }

  function eventOrigin(e) {
    if (e && typeof e.clientX === 'number' && typeof e.clientY === 'number') {
      return { x: e.clientX, y: e.clientY };
    }
    return particleOrigin();
  }

  function pickAsset(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  // Decode the SVGs once so the first reaction doesn't pop in late.
  function preloadEffects() {
    Object.keys(EFFECTS).forEach(function (key) {
      EFFECTS[key].forEach(function (src) {
        var img = new Image();
        img.src = src;
      });
    });
  }

  function preloadStickers() {
    Object.keys(STICKERS).forEach(function (key) {
      var img = new Image();
      img.src = STICKERS[key];
    });
  }

  // A small bubble with the reaction image pops out above the pet's shoulder
  // and fades away. A newer reaction replaces the old one.
  function showSticker(kind) {
    var src = STICKERS[kind];
    if (!stickerLayer || !src) return;
    stickerLayer.innerHTML = '';
    var card = document.createElement('div');
    card.className = 'sticker-pop';
    var img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.draggable = false;
    card.appendChild(img);
    if (STICKER_CAPTIONS[kind]) {
      var caption = document.createElement('span');
      caption.className = 'sticker-caption';
      caption.textContent = STICKER_CAPTIONS[kind];
      card.appendChild(caption);
    }
    stickerLayer.appendChild(card);
    if (stickerTimer) clearTimeout(stickerTimer);
    stickerTimer = setTimeout(function () {
      stickerTimer = null;
      if (card.parentNode) card.parentNode.removeChild(card);
    }, STICKER_MS);
  }

  /**
   * Spawn image particles. `anim` picks the motion (fx-float / fx-pop /
   * fx-drop / fx-zzz) and the CSS custom properties carry per-particle
   * travel, rotation and size.
   */
  function spawnEffect(list, count, opts) {
    var layer = opts.layer || particleLayer;
    if (!layer || !list || !list.length) return;

    var origin = opts.origin || particleOrigin();
    var jitterX = opts.jitterX == null ? 24 : opts.jitterX;
    var jitterY = opts.jitterY == null ? 16 : opts.jitterY;
    var sizeMin = opts.sizeMin == null ? 14 : opts.sizeMin;
    var sizeMax = opts.sizeMax == null ? 22 : opts.sizeMax;
    var travelX = opts.travelX == null ? 40 : opts.travelX;
    var travelY = opts.travelY == null ? 70 : opts.travelY;
    var rot = opts.rot == null ? 30 : opts.rot;
    var spin = opts.spin == null ? 50 : opts.spin;
    var durationMin = opts.durationMin == null ? 1.4 : opts.durationMin;
    var durationMax = opts.durationMax == null ? 2.1 : opts.durationMax;
    var stagger = opts.stagger == null ? 0.05 : opts.stagger;
    var biasX = opts.biasX || 0;

    for (var i = 0; i < count; i++) {
      var img = document.createElement('img');
      img.className = 'fx-particle ' + (opts.anim || 'fx-float');
      img.src = pickAsset(list);
      img.alt = '';
      img.draggable = false;
      img.style.left = (origin.x + rand(-jitterX, jitterX)) + 'px';
      img.style.top = (origin.y + rand(-jitterY, jitterY)) + 'px';
      img.style.setProperty('--size', rand(sizeMin, sizeMax).toFixed(1) + 'px');
      img.style.setProperty('--dx', (biasX + rand(-travelX, travelX)).toFixed(1) + 'px');
      if (opts.anim === 'fx-drop') {
        img.style.setProperty('--dy', rand(travelY * 0.8, travelY * 1.2).toFixed(1) + 'px');
      } else {
        img.style.setProperty('--dy', (-rand(travelY * 0.7, travelY * 1.2)).toFixed(1) + 'px');
      }
      img.style.setProperty('--rot0', rand(-rot, rot).toFixed(1) + 'deg');
      img.style.setProperty('--spin', rand(-spin, spin).toFixed(1) + 'deg');
      img.style.animationDuration = rand(durationMin, durationMax).toFixed(2) + 's';
      img.style.animationDelay = (i * stagger + rand(0, stagger)).toFixed(2) + 's';
      layer.appendChild(img);
      img.addEventListener('animationend', removeNode);
    }
  }

  function spawnHearts(origin) {
    if (!heartsLayer) return;
    var o = origin || particleOrigin();

    spawnEffect(EFFECTS.hearts, 4, {
      layer: heartsLayer, origin: o, anim: 'fx-float',
      sizeMin: 18, sizeMax: 28, jitterX: 24, jitterY: 14,
      travelX: 40, travelY: 90, rot: 28, spin: 55,
      durationMin: 1.45, durationMax: 2.1, stagger: 0.07
    });
    spawnEffect(EFFECTS.sparkles, 3, {
      layer: heartsLayer, origin: o, anim: 'fx-float',
      sizeMin: 10, sizeMax: 18, jitterX: 32, jitterY: 20,
      travelX: 52, travelY: 72, rot: 90, spin: 160,
      durationMin: 1.1, durationMax: 1.7, stagger: 0.06
    });
    if (Math.random() < 0.45) {
      spawnEffect(EFFECTS.notes, 1, {
        layer: heartsLayer, origin: o, anim: 'fx-float',
        sizeMin: 15, sizeMax: 20, jitterX: 22, jitterY: 11,
        travelX: 32, travelY: 96, rot: 18, spin: 35,
        durationMin: 1.5, durationMax: 1.9, stagger: 0
      });
    }
  }

  function spawnFoodParticles(origin) {
    spawnEffect(EFFECTS.food, 4, {
      layer: particleLayer, origin: origin || particleOrigin(), anim: 'fx-drop',
      sizeMin: 18, sizeMax: 26, jitterX: 20, jitterY: 7,
      travelX: 24, travelY: 44, rot: 20, spin: 24,
      durationMin: 0.85, durationMax: 1.25, stagger: 0.09
    });
  }

  function spawnAnger(origin) {
    var o = origin || particleOrigin();
    spawnEffect(EFFECTS.anger, 1, {
      layer: particleLayer, origin: o, anim: 'fx-pop',
      sizeMin: 34, sizeMax: 42, jitterX: 2, jitterY: 2,
      travelX: 5, travelY: 10, rot: 8, spin: 14,
      durationMin: 0.75, durationMax: 0.9, stagger: 0
    });
    spawnEffect(EFFECTS.steam, 2, {
      layer: particleLayer, origin: o, anim: 'fx-pop',
      sizeMin: 18, sizeMax: 26, jitterX: 28, jitterY: 18,
      travelX: 30, travelY: 20, rot: 20, spin: 40,
      durationMin: 0.8, durationMax: 1.1, stagger: 0.05
    });
    spawnEffect(EFFECTS.redSparks, 3, {
      layer: particleLayer, origin: o, anim: 'fx-pop',
      sizeMin: 10, sizeMax: 16, jitterX: 32, jitterY: 22,
      travelX: 46, travelY: 28, rot: 90, spin: 140,
      durationMin: 0.6, durationMax: 0.9, stagger: 0.04
    });
  }

  function spawnSurprise(origin) {
    var o = origin || particleOrigin();
    spawnEffect(EFFECTS.exclaim, 1, {
      layer: particleLayer, origin: o, anim: 'fx-pop',
      sizeMin: 32, sizeMax: 38, jitterX: 2, jitterY: 2,
      travelX: 5, travelY: 16, rot: 10, spin: 16,
      durationMin: 0.8, durationMax: 0.95, stagger: 0
    });
    spawnEffect(EFFECTS.sparkles, 3, {
      layer: particleLayer, origin: o, anim: 'fx-pop',
      sizeMin: 12, sizeMax: 20, jitterX: 32, jitterY: 20,
      travelX: 42, travelY: 32, rot: 90, spin: 150,
      durationMin: 0.65, durationMax: 0.95, stagger: 0.05
    });
  }

  function spawnTouchRipple(x, y, strong) {
    if (!particleLayer) return;
    var ring = document.createElement('span');
    ring.className = 'touch-ripple' + (strong ? ' strong' : '');
    ring.style.left = x + 'px';
    ring.style.top = y + 'px';
    particleLayer.appendChild(ring);
    ring.addEventListener('animationend', removeNode);
  }

  function spawnZzz() {
    if (!particleLayer || !petImage) return;
    var rect = petImage.getBoundingClientRect();
    spawnEffect(EFFECTS.zzz, 1, {
      layer: particleLayer,
      origin: { x: rect.width * 0.7, y: rect.height * 0.24 },
      anim: 'fx-zzz',
      sizeMin: 16, sizeMax: 22, jitterX: 20, jitterY: 15,
      travelX: 12, travelY: 48, biasX: 16, rot: 8, spin: 16,
      durationMin: 1.8, durationMax: 2.4, stagger: 0
    });
  }

  function removeNode() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  // ---------- native menu commands ----------
  function pollCommand() {
    invoke('poll_pet_command').then(function (cmd) {
      if (cmd) handleCommand(cmd);
    }).catch(function () {});
  }

  function handleCommand(cmd) {
    switch (cmd) {
      case 'cmd.feed': triggerClickResponse(null, 'eating'); break;
      case 'cmd.pet': triggerClickResponse(null, 'happy'); break;
      case 'cmd.home': goHome(); break;
      case 'cmd.wander': if (!startWander()) playOneShot('hop'); break;
      case 'cmd.sleep': goToSleep(); break;
      case 'cmd.wake': wakeUp(); break;
      case 'anim.idle':
        clearActionTimer();
        clearChainTimer();
        setFacing('right');
        setAnim('idle');
        resetIdleTimer();
        scheduleNextAction();
        break;
      case 'anim.turn': doTurn(); break;
      case 'anim.walk': if (!startWander()) playOneShot('hop'); break;
      default:
        if (cmd.indexOf('anim.') === 0) {
          var name = cmd.slice(5);
          if (ONE_SHOT[name]) playOneShot(name);
        }
    }
  }

  // ---------- events ----------
  function bindEvents() {
    document.addEventListener('pointerdown', onPointerDown, { passive: false });
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    // Fallback for environments where pointer capture loses the release event.
    window.addEventListener('mouseup', function (e) {
      if (drag.active) onPointerUp(e);
    });
    window.addEventListener('blur', function () {
      if (drag.active) onPointerCancel();
    });

    document.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      if (drag.active) return;
      wakeUp();
      invoke('show_pet_menu').catch(function () {});
    });

    window.addEventListener('dragstart', function (e) { e.preventDefault(); });

    window.addEventListener('focus', function () {
      refreshRuntime(true);
      if (!isBusy()) syncWindow();
    });

    window.addEventListener('resize', function () {
      updateStageTransform();
      if (rig) rig.layout();
    });

    window.addEventListener('beforeunload', function () {
      persistPosition();
    });
  }

  // ---------- public hooks for voice-chat.js ----------
  window.petReaction = {
    thinking: function (on) {
      if (on) {
        wakeUp();
        if (isBusy() || sleeping) return;
        thinkingActive = true;
        clearActionTimer();
        clearChainTimer();
        setAnim('thinking');
        resetIdleTimer();
      } else {
        thinkingActive = false;
        if (animState === 'thinking' && !isBusy()) returnToIdle();
      }
    },
    happy: function () {
      wakeUp();
      if (isBusy() || sleeping) return;
      playOneShot('happy');
      showSticker('happy');
    }
  };

  // ---------- boot ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
