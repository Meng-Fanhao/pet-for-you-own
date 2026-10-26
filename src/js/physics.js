// Copyright (c) 2026 孟凡皓 (cn.bj). All rights reserved.
// Drag / throw physics, ported from dsh-pet's shared/physics.ts.
// Pure functions only: no DOM, no Tauri. Coordinates are logical (CSS) pixels;
// the pet's "box" is the transparent window's top-left corner.

var PetPhysics = (function () {
  // --- spring follow ---
  var SPRING_K = 200;          // stiffness: larger = tighter follow
  var SPRING_C = 30;           // damping: zeta ~= 1.06, critically damped
  var DEFAULT_THROW_POWER = 1;

  // --- release velocity estimation ---
  var TRAIL_KEEP_MS = 200;
  var RELEASE_WINDOW_MS = 150;
  var RELEASE_STALE_MS = 150;
  var MIN_SPAN_MS = 20;
  var SEG_MIN_DT_MS = 8;
  var DEAD_ZONE_SPEED = 500;
  var MAX_THROW_SPEED = 3600;
  var PEAK_WEIGHT = 0.5;
  var ACCEL_REF = 8000;
  var ACCEL_GAIN_MAX = 0.6;

  // --- throw simulation defaults ---
  var GRAVITY = 1400;
  var RESTITUTION = 0.78;
  var GROUND_FRICTION = 2.5;
  var REST_VY = 40;
  var REST_VX = 15;
  var MAX_STEP_DT = 0.05;

  // --- squash & stretch ---
  var SQ_SQUASH = 0.55;
  var SQ_DURATION_MS = 220;
  var SQ_SOFT_SPEED = 300;
  var SQ_HARD_SPEED = 1500;
  var SQ_MAX_SQUASH = 0.55;

  function defaultPhysics() {
    return {
      gravity: GRAVITY,
      restitution: RESTITUTION,
      groundFriction: GROUND_FRICTION,
      ceilingBounce: true,
      throwPower: DEFAULT_THROW_POWER
    };
  }

  function trimTrail(trail, now) {
    var cutoff = now - TRAIL_KEEP_MS;
    var i = 0;
    while (i < trail.length && trail[i].t < cutoff) i++;
    return i === 0 ? trail : trail.slice(i);
  }

  // Over-damped spring velocity step for one axis.
  function springStep(v, x, target, dt, power) {
    var p = (typeof power === 'number' && power > 0) ? power : DEFAULT_THROW_POWER;
    return v + ((target - x) * SPRING_K - v * SPRING_C) * p * dt;
  }

  // Soft speed cap: monotonic, asymptotically below cap.
  function softClampSpeed(speed) {
    if (speed <= 0) return 0;
    return MAX_THROW_SPEED * (1 - Math.exp(-speed / MAX_THROW_SPEED));
  }

  // Estimate release velocity from pointer trail samples. null = gentle drop.
  function estimateReleaseVelocity(trail, now, physics) {
    if (!trail || trail.length === 0) return null;
    var last = trail[trail.length - 1];
    if (now - last.t > RELEASE_STALE_MS) return null;

    var win = [];
    for (var i = 0; i < trail.length; i++) {
      if (now - trail[i].t <= RELEASE_WINDOW_MS) win.push(trail[i]);
    }
    if (win.length < 2) return null;

    var t0 = win[0].t, x0 = win[0].x, y0 = win[0].y;
    var t1 = win[win.length - 1].t, x1 = win[win.length - 1].x, y1 = win[win.length - 1].y;
    var spanMs = t1 - t0;
    if (spanMs < MIN_SPAN_MS) return null;

    var baseVx = ((x1 - x0) / spanMs) * 1000;
    var baseVy = ((y1 - y0) / spanMs) * 1000;
    var baseSpeed = Math.hypot(baseVx, baseVy);
    if (baseSpeed < 1e-6) return null;

    // Segment speeds (merge over-dense samples, minimum dt).
    var segSpeeds = [];
    var px = x0, py = y0, pt = t0;
    for (var j = 1; j < win.length; j++) {
      var s = win[j];
      var dt = s.t - pt;
      if (dt >= SEG_MIN_DT_MS) {
        segSpeeds.push({ speed: (Math.hypot(s.x - px, s.y - py) / dt) * 1000, tEnd: s.t });
        px = s.x;
        py = s.y;
        pt = s.t;
      }
    }
    var peakSpeed = baseSpeed;
    if (segSpeeds.length) {
      peakSpeed = 0;
      for (var k = 0; k < segSpeeds.length; k++) {
        if (segSpeeds[k].speed > peakSpeed) peakSpeed = segSpeeds[k].speed;
      }
    }

    // Acceleration gain: still accelerating throws get a boost.
    var accel = 0;
    if (segSpeeds.length >= 2) {
      var lastSeg = segSpeeds[segSpeeds.length - 1];
      var firstSeg = segSpeeds[0];
      accel = (lastSeg.speed - firstSeg.speed) /
        Math.max((lastSeg.tEnd - firstSeg.tEnd) / 1000, MIN_SPAN_MS / 1000);
    }

    var speedBeforeClamp =
      ((1 - PEAK_WEIGHT) * baseSpeed + PEAK_WEIGHT * peakSpeed) *
      (1 + Math.min(Math.max(accel, 0) / ACCEL_REF, 1) * ACCEL_GAIN_MAX);
    var power = (physics && physics.throwPower > 0) ? physics.throwPower : DEFAULT_THROW_POWER;
    var speed = softClampSpeed(speedBeforeClamp) * power;
    if (speed < DEAD_ZONE_SPEED) return null;

    return {
      vx: (baseVx / baseSpeed) * speed,
      vy: (baseVy / baseSpeed) * speed
    };
  }

  // One integration step with edge bounce. Returns new state + flags.
  function throwStep(s, dtRaw, b, physics) {
    var p = physics || defaultPhysics();
    var dt = Math.min(Math.max(dtRaw, 0), MAX_STEP_DT);
    var x = s.x, y = s.y, vx = s.vx, vy = s.vy;

    vy += p.gravity * dt;
    x += vx * dt;
    y += vy * dt;

    var bounced = false;
    if (x < b.minX) {
      x = b.minX;
      vx = Math.abs(vx) * p.restitution;
      bounced = true;
    } else if (x > b.maxX) {
      x = b.maxX;
      vx = -Math.abs(vx) * p.restitution;
      bounced = true;
    }
    if (y < b.minY) {
      if (p.ceilingBounce) {
        y = b.minY;
        vy = Math.abs(vy) * p.restitution;
        bounced = true;
      }
    } else if (y >= b.maxY) {
      y = b.maxY;
      vx *= Math.max(0, 1 - p.groundFriction * dt);
      if (Math.abs(vy) < REST_VY) vy = 0;
      else vy = -Math.abs(vy) * p.restitution;
      bounced = true;
    }

    var speed = Math.hypot(vx, vy);
    var atRest =
      (y >= b.maxY - 1 && Math.abs(vy) < 1 && Math.abs(vx) < REST_VX) ||
      (bounced && speed < REST_VY && Math.abs(vy) < 1);

    return { x: x, y: y, vx: vx, vy: vy, bounced: bounced, atRest: atRest };
  }

  // Squash curve: u in [0,1] -> scaleY. Compress then easeOutBack overshoot.
  function squashScale(u, squash) {
    var sq = (typeof squash === 'number') ? squash : SQ_SQUASH;
    if (u < 0.45) {
      var p = u / 0.45;
      return 1 - (1 - sq) * p * p;
    }
    var q = (u - 0.45) / 0.55;
    var c1 = 1.70158;
    var c3 = c1 + 1;
    var f = 1 + c3 * Math.pow(q - 1, 3) + c1 * Math.pow(q - 1, 2);
    return Math.min(1.12, sq + (1 - sq) * Math.max(f, 0));
  }

  // Landing impact speed -> squash depth (lighter fall = 0.8, hard = 0.55).
  function landingSquash(impactSpeed) {
    var t = Math.min(Math.max((Math.abs(impactSpeed) - SQ_SOFT_SPEED) / (SQ_HARD_SPEED - SQ_SOFT_SPEED), 0), 1);
    return Math.min(0.8, 1 - t * (1 - SQ_MAX_SQUASH));
  }

  // Bounds for the window's top-left corner inside a screen work area.
  function boundsFromScreen(screen, winW, winH) {
    var area = screen && screen.work_width > 0
      ? { x: screen.work_x, y: screen.work_y, width: screen.work_width, height: screen.work_height }
      : { x: screen.x, y: screen.y, width: screen.width, height: screen.height };
    return {
      minX: area.x,
      minY: area.y,
      maxX: Math.max(area.x, area.x + area.width - winW),
      maxY: Math.max(area.y, area.y + area.height - winH),
      area: area
    };
  }

  return {
    DEFAULT_PHYSICS: defaultPhysics,
    SPRING_K: SPRING_K,
    SPRING_C: SPRING_C,
    SQ_SQUASH: SQ_SQUASH,
    SQ_DURATION_MS: SQ_DURATION_MS,
    trimTrail: trimTrail,
    springStep: springStep,
    softClampSpeed: softClampSpeed,
    estimateReleaseVelocity: estimateReleaseVelocity,
    throwStep: throwStep,
    squashScale: squashScale,
    landingSquash: landingSquash,
    boundsFromScreen: boundsFromScreen
  };
})();
