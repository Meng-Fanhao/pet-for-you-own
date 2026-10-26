// Copyright (c) 2026 孟凡皓 (cn.bj). All rights reserved.
// Pose-driven paper-doll rig.
//
// The uploaded photo is segmented into a static base plus movable pieces:
// head, upper arms, forearms/hands, chest, and two skirt panels that stand in
// for the legs (the gown hides the actual legs, so the panels swing instead).
// Each piece keeps the original pixels and an overlapping, pose-derived mask,
// so the joints stay covered while the pieces rotate.
//
// Motion is driven by the CSS keyframes in pet.css: the body, head, arms and
// forearms animate per state, while the chest and skirt panels ride along with
// the body (their masks let a future pass animate them independently without
// tearing the gown).



(function () {
  'use strict';

  var POSE_MODEL = 'assets/models/pose_landmarker_lite.task';
  var WASM_BASE = 'vendor/mediapipe/wasm';
  var MAX_WORK = 900;
  var MIN_VIS = 0.35;
  var ALPHA_MIN = 16;

  var posePromise = null;

  // ---------- small helpers ----------
  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function mid(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.decoding = 'async';
      im.onload = function () {
        if (im.naturalWidth > 1 && im.naturalHeight > 1) resolve(im);
        else reject(new Error('empty image'));
      };
      im.onerror = function () { reject(new Error('image load failed')); };
      im.src = src;
    });
  }

  function getLandmarker() {
    if (posePromise) return posePromise;
    if (!window.Vision || !window.Vision.FilesetResolver || !window.Vision.PoseLandmarker) {
      return Promise.reject(new Error('MediaPipe pose is unavailable'));
    }
    posePromise = window.Vision.FilesetResolver.forVisionTasks(WASM_BASE)
      .then(function (fileset) {
        var options = {
          baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' },
          runningMode: 'IMAGE',
          numPoses: 1,
          minPoseDetectionConfidence: 0.3,
          minPosePresenceConfidence: 0.3,
          minTrackingConfidence: 0.3
        };
        return window.Vision.PoseLandmarker.createFromOptions(fileset, options)
          .catch(function () {
            options.baseOptions.delegate = 'CPU';
            return window.Vision.PoseLandmarker.createFromOptions(fileset, options);
          });
      })
      .catch(function (err) {
        posePromise = null;
        throw err;
      });
    return posePromise;
  }

  function alphaAt(data, w, x, y) {
    return data[(y * w + x) * 4 + 3];
  }

  // ---------- image analysis ----------
  function prepareWork(img) {
    var nw = img.naturalWidth;
    var nh = img.naturalHeight;
    var scale = Math.min(1, MAX_WORK / Math.max(nw, nh));
    var w = Math.max(2, Math.round(nw * scale));
    var h = Math.max(2, Math.round(nh * scale));
    var canvas = makeCanvas(w, h);
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    var imageData = ctx.getImageData(0, 0, w, h);
    return { canvas: canvas, ctx: ctx, w: w, h: h, data: imageData.data, imageData: imageData };
  }

  function looksLikeCutout(data, w, h) {
    var corners = [
      [2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]
    ];
    var opaque = 0;
    corners.forEach(function (p) {
      if (alphaAt(data, w, p[0], p[1]) > 230) opaque++;
    });
    return opaque < 3;
  }

  function alphaBounds(data, w, h) {
    var minX = w, minY = h, maxX = -1, maxY = -1;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > ALPHA_MIN) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  function topAlphaY(data, w, h, cx, halfWindow) {
    var x0 = Math.max(0, Math.floor(cx - halfWindow));
    var x1 = Math.min(w - 1, Math.ceil(cx + halfWindow));
    for (var y = 0; y < h; y++) {
      for (var x = x0; x <= x1; x++) {
        if (alphaAt(data, w, x, y) > 24) return y;
      }
    }
    return 0;
  }

  // Width of the silhouette around cx at y. Ignores isolated specks by
  // requiring a short run of transparency before it stops.
  function halfWidthAt(data, w, h, cx, y, maxHalf) {
    var best = 0;
    var miss = 0;
    var limit = Math.min(maxHalf, Math.max(cx, w - 1 - cx));
    for (var d = 0; d <= limit; d++) {
      var inside = false;
      for (var yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++) {
        if (d === 0) {
          if (alphaAt(data, w, Math.round(cx), yy) > 24) inside = true;
        } else {
          if (alphaAt(data, w, Math.round(cx - d), yy) > 24) inside = true;
          if (alphaAt(data, w, Math.round(cx + d), yy) > 24) inside = true;
        }
        if (inside) break;
      }
      if (inside) {
        best = d;
        miss = 0;
      } else {
        miss++;
        if (miss > 5) break;
      }
    }
    return best;
  }

  function pointAt(pts, index, w, h) {
    var p = pts[index];
    return {
      x: p.x * w,
      y: p.y * h,
      v: (typeof p.visibility === 'number' ? p.visibility : 1)
    };
  }

  function distToSegment(px, py, a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var len2 = dx * dx + dy * dy;
    if (len2 < 0.0001) return Math.hypot(px - a.x, py - a.y);
    var t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
  }

  function capsuleMask(w, h, data, a, b, radius, extendEnd) {
    var tip = b;
    if (extendEnd) {
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var len = Math.hypot(dx, dy) || 1;
      tip = { x: b.x + dx / len * extendEnd, y: b.y + dy / len * extendEnd };
    }
    var minX = Math.max(0, Math.floor(Math.min(a.x, tip.x) - radius - 1));
    var maxX = Math.min(w - 1, Math.ceil(Math.max(a.x, tip.x) + radius + 1));
    var minY = Math.max(0, Math.floor(Math.min(a.y, tip.y) - radius - 1));
    var maxY = Math.min(h - 1, Math.ceil(Math.max(a.y, tip.y) + radius + 1));
    var mask = new Uint8Array(w * h);
    var pixels = 0;
    for (var y = minY; y <= maxY; y++) {
      for (var x = minX; x <= maxX; x++) {
        var i = y * w + x;
        if (data[i * 4 + 3] <= ALPHA_MIN) continue;
        if (distToSegment(x, y, a, tip) <= radius) {
          mask[i] = 255;
          pixels++;
        }
      }
    }
    return { mask: mask, pixels: pixels };
  }

  function headMask(w, h, data, cx, topY, neckY, bottomY, halfTop, halfBottom) {
    var mask = new Uint8Array(w * h);
    var pixels = 0;
    var y0 = Math.max(0, Math.floor(topY));
    var y1 = Math.min(h - 1, Math.ceil(bottomY));
    for (var y = y0; y <= y1; y++) {
      var t = clamp((y - topY) / Math.max(1, neckY - topY), 0, 1);
      var half = y > neckY ? halfBottom : lerp(halfTop, halfBottom, t * t);
      var x0 = Math.max(0, Math.floor(cx - half));
      var x1 = Math.min(w - 1, Math.ceil(cx + half));
      for (var x = x0; x <= x1; x++) {
        var i = y * w + x;
        if (data[i * 4 + 3] > ALPHA_MIN) {
          mask[i] = 255;
          pixels++;
        }
      }
    }
    return { mask: mask, pixels: pixels };
  }

  function maskToURL(mask, w, h) {
    var canvas = makeCanvas(w, h);
    var ctx = canvas.getContext('2d');
    var id = ctx.createImageData(w, h);
    for (var i = 0; i < mask.length; i++) {
      id.data[i * 4 + 3] = 255;
      if (mask[i]) {
        id.data[i * 4] = 255;
        id.data[i * 4 + 1] = 255;
        id.data[i * 4 + 2] = 255;
      }
    }
    ctx.putImageData(id, 0, 0);
    return canvas.toDataURL('image/png');
  }

  function maskBounds(mask, w, h) {
    var minX = w, minY = h, maxX = -1, maxY = -1;
    for (var y = 0; y < h; y++) {
      var row = y * w;
      for (var x = 0; x < w; x++) {
        if (mask[row + x]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  // Crop a masked part out of the working image and multiply its alpha by
  // the mask. The padding keeps the original antialiased silhouette edge.
  function makePart(work, mask, bounds, pad) {
    pad = pad || 1;
    var bx = Math.max(0, bounds.x - pad);
    var by = Math.max(0, bounds.y - pad);
    var bw = Math.min(work.w - bx, bounds.w + pad * 2);
    var bh = Math.min(work.h - by, bounds.h + pad * 2);
    var canvas = makeCanvas(bw, bh);
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(work.canvas, bx, by, bw, bh, 0, 0, bw, bh);
    var id = ctx.getImageData(0, 0, bw, bh);
    var d = id.data;
    for (var y = 0; y < bh; y++) {
      var row = (by + y) * work.w + bx;
      for (var x = 0; x < bw; x++) {
        var di = (y * bw + x) * 4 + 3;
        if (!mask[row + x]) {
          d[di] = 0;
        }
      }
    }
    ctx.putImageData(id, 0, 0);
    return {
      url: canvas.toDataURL('image/png'),
      x: bx, y: by, w: bw, h: bh
    };
  }

  // Replace the pixels that belong to movable parts with the nearest static
  // colour. This is what sits behind a limb when it swings away. Nearest
  // source via multi-source BFS is fast enough at these sizes and smooth
  // enough once the sprite is displayed at ~256px.
  function makeBase(work, masks) {
    var w = work.w, h = work.h, data = work.data;
    var moving = new Uint8Array(w * h);
    masks.forEach(function (m) {
      for (var i = 0; i < m.length; i++) {
        if (m[i]) moving[i] = 1;
      }
    });

    // Dilate by one pixel so the base also covers the soft cut edges.
    var dilated = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = y * w + x;
        if (!moving[i]) continue;
        for (var oy = -1; oy <= 1; oy++) {
          var yy = y + oy;
          if (yy < 0 || yy >= h) continue;
          for (var ox = -1; ox <= 1; ox++) {
            var xx = x + ox;
            if (xx < 0 || xx >= w) continue;
            dilated[yy * w + xx] = 1;
          }
        }
      }
    }

    var out = new Uint8ClampedArray(data);
    var visited = new Uint8Array(w * h);
    var source = new Int32Array(w * h);
    var queue = new Int32Array(w * h);
    var head = 0, tail = 0;

    for (var p = 0; p < w * h; p++) {
      if (data[p * 4 + 3] > ALPHA_MIN && !dilated[p]) {
        visited[p] = 1;
        source[p] = p;
        queue[tail++] = p;
      }
    }

    while (head < tail) {
      var cur = queue[head++];
      var cx = cur % w;
      var cy = (cur / w) | 0;
      var src = source[cur];
      for (var k = 0; k < 4; k++) {
        var nx = cx + (k === 0 ? -1 : k === 1 ? 1 : 0);
        var ny = cy + (k === 2 ? -1 : k === 3 ? 1 : 0);
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        var n = ny * w + nx;
        if (visited[n] || !dilated[n]) continue;
        if (data[n * 4 + 3] <= ALPHA_MIN) continue;
        visited[n] = 1;
        source[n] = src;
        out[n * 4] = out[src * 4];
        out[n * 4 + 1] = out[src * 4 + 1];
        out[n * 4 + 2] = out[src * 4 + 2];
        queue[tail++] = n;
      }
    }

    var canvas = makeCanvas(w, h);
    var ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(out, w, h), 0, 0);
    return canvas;
  }

  function cropCanvas(canvas, bounds) {
    var c = makeCanvas(bounds.w, bounds.h);
    c.getContext('2d').drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
    return c;
  }

  // ---------- DOM ----------
  function makeImg(part, cls) {
    var im = document.createElement('img');
    im.className = cls || '';
    im.src = part.url;
    im.draggable = false;
    im.alt = '';
    im.style.left = part.x + 'px';
    im.style.top = part.y + 'px';
    im.style.width = part.w + 'px';
    im.style.height = part.h + 'px';
    return im;
  }

  function makePartEl(part, cls, pivot, parent) {
    var wrap = document.createElement('div');
    wrap.className = 'rig-part ' + cls;
    wrap.style.transformOrigin = pivot.x + 'px ' + pivot.y + 'px';
    wrap.appendChild(makeImg(part));
    parent.appendChild(wrap);
    return wrap;
  }

  function createRig(img, pts) {
    var work = prepareWork(img);
    var w = work.w, h = work.h;
    if (!looksLikeCutout(work.data, w, h)) throw new Error('not a cutout');

    var bounds = alphaBounds(work.data, w, h);
    if (!bounds) throw new Error('empty alpha');
    if (bounds.w * bounds.h < w * h * 0.04) throw new Error('subject too small');

    var required = [0, 11, 12, 13, 14, 15, 16, 23, 24];
    for (var r = 0; r < required.length; r++) {
      var q = pts[required[r]];
      if (!q || (typeof q.visibility === 'number' && q.visibility < MIN_VIS)) {
        throw new Error('pose missing landmark ' + required[r]);
      }
    }

    var nose = pointAt(pts, 0, w, h);
    var shL = pointAt(pts, 11, w, h);
    var shR = pointAt(pts, 12, w, h);
    var elL = pointAt(pts, 13, w, h);
    var elR = pointAt(pts, 14, w, h);
    var wrL = pointAt(pts, 15, w, h);
    var wrR = pointAt(pts, 16, w, h);
    var hipL = pointAt(pts, 23, w, h);
    var hipR = pointAt(pts, 24, w, h);
    var shMid = mid(shL, shR);
    var hipMid = mid(hipL, hipR);

    if (hipMid.y - shMid.y < h * 0.06) throw new Error('not a full figure');
    if (dist(shL, shR) < w * 0.06) throw new Error('shoulders too close');

    var torsoH = Math.max(1, hipMid.y - shMid.y);
    var neck = { x: shMid.x, y: lerp(nose.y, shMid.y, 0.8) };
    var headTop = topAlphaY(work.data, w, h, nose.x, w * 0.3);
    headTop = Math.min(headTop, neck.y - h * 0.05);
    var headBottom = neck.y + torsoH * 0.055;
    var earDist = Math.abs(pointAt(pts, 7, w, h).x - pointAt(pts, 8, w, h).x);
    var headHalfBottom = clamp(Math.max(earDist * 1.4, w * 0.09), w * 0.07, w * 0.21);
    var headHalfTop = Math.max(
      halfWidthAt(work.data, w, h, neck.x, headTop + (neck.y - headTop) * 0.04, w * 0.46),
      halfWidthAt(work.data, w, h, neck.x, headTop + (neck.y - headTop) * 0.14, w * 0.46)
    );
    headHalfTop = clamp(headHalfTop + w * 0.01, headHalfBottom * 1.02, w * 0.46);

    var head = headMask(w, h, work.data, neck.x, headTop, neck.y, headBottom, headHalfTop, headHalfBottom);
    if (head.pixels < w * h * 0.015) throw new Error('head mask too small');

    var shoulderSpan = dist(shL, shR);
    var upperR = clamp(shoulderSpan * 0.23, w * 0.055, w * 0.13);
    var foreR = clamp(shoulderSpan * 0.19, w * 0.045, w * 0.11);
    var extendL = Math.min(dist(elL, wrL) * 0.45, h * 0.08);
    var extendR = Math.min(dist(elR, wrR) * 0.45, h * 0.08);

    var armA = capsuleMask(w, h, work.data, shL, elL, upperR, 0);
    var armB = capsuleMask(w, h, work.data, shR, elR, upperR, 0);
    var foreA = capsuleMask(w, h, work.data, elL, wrL, foreR, extendL);
    var foreB = capsuleMask(w, h, work.data, elR, wrR, foreR, extendR);

    if (armA.pixels < 250) armA = null;
    if (armB.pixels < 250) armB = null;
    if (foreA.pixels < 200) foreA = null;
    if (foreB.pixels < 200) foreB = null;

    // ---------- torso and skirt-panel masks ----------
    // Pieces may overlap at the seams; the overlapping band is drawn by the
    // topmost piece and the inpainted base fills whatever a rotation uncovers.
    var limbMasks = [armA, armB, foreA, foreB].filter(function (p) { return !!p; })
      .map(function (p) { return p.mask; });
    function limbAt(i) {
      if (head.mask[i]) return true;
      for (var m = 0; m < limbMasks.length; m++) {
        if (limbMasks[m][i]) return true;
      }
      return false;
    }

    var chest = { mask: new Uint8Array(w * h), pixels: 0 };
    var chestTop = Math.max(0, Math.floor(neck.y - h * 0.012));
    var chestBottom = Math.min(h - 1, Math.ceil(hipMid.y));
    var chestMinX = clamp(Math.floor(Math.min(shL.x, shR.x, hipL.x, hipR.x) - shoulderSpan * 0.38), 0, w - 1);
    var chestMaxX = clamp(Math.ceil(Math.max(shL.x, shR.x, hipL.x, hipR.x) + shoulderSpan * 0.38), 0, w - 1);
    for (var cy = chestTop; cy <= chestBottom; cy++) {
      for (var cx = chestMinX; cx <= chestMaxX; cx++) {
        var ci = cy * w + cx;
        if (work.data[ci * 4 + 3] <= ALPHA_MIN || limbAt(ci)) continue;
        chest.mask[ci] = 255;
        chest.pixels++;
      }
    }

    // The gown hides the legs, so the two skirt halves act as leg proxies.
    // They meet under the waist with a few pixels of overlap.
    var legL = { mask: new Uint8Array(w * h), pixels: 0 };
    var legR = { mask: new Uint8Array(w * h), pixels: 0 };
    var skirtTop = Math.max(0, Math.round(hipMid.y - h * 0.016));
    var splitX = hipMid.x;
    for (var sy = skirtTop; sy < h; sy++) {
      for (var sx = 0; sx < w; sx++) {
        var si = sy * w + sx;
        if (work.data[si * 4 + 3] <= ALPHA_MIN || limbAt(si)) continue;
        if (sx < splitX) {
          legL.mask[si] = 255;
          legL.pixels++;
        } else {
          legR.mask[si] = 255;
          legR.pixels++;
        }
      }
    }

    var chestPart = chest.pixels > w * h * 0.012
      ? makePart(work, chest.mask, maskBounds(chest.mask, w, h), 1) : null;
    var legLPart = legL.pixels > 400
      ? makePart(work, legL.mask, maskBounds(legL.mask, w, h), 1) : null;
    var legRPart = legR.pixels > 400
      ? makePart(work, legR.mask, maskBounds(legR.mask, w, h), 1) : null;

    var masks = [head.mask];
    [armA, armB, foreA, foreB].forEach(function (p) {
      if (p) masks.push(p.mask);
    });
    if (chestPart) masks.push(chest.mask);
    if (legLPart) masks.push(legL.mask);
    if (legRPart) masks.push(legR.mask);

    var headPart = makePart(work, head.mask, maskBounds(head.mask, w, h), 1);
    var armAPart = armA ? makePart(work, armA.mask, maskBounds(armA.mask, w, h), 1) : null;
    var armBPart = armB ? makePart(work, armB.mask, maskBounds(armB.mask, w, h), 1) : null;
    var foreAPart = foreA ? makePart(work, foreA.mask, maskBounds(foreA.mask, w, h), 1) : null;
    var foreBPart = foreB ? makePart(work, foreB.mask, maskBounds(foreB.mask, w, h), 1) : null;

    var baseCanvas = makeBase(work, masks);

    // Behind the head there is usually empty background, so filling it from
    // the neck would leave a ghost silhouette when the head tilts. Keep only
    // the neck overlap filled; clear the rest.
    var baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
    var baseId = baseCtx.getImageData(0, 0, w, h);
    var baseData = baseId.data;
    for (var by = 0; by < Math.max(0, headBottom - 3); by++) {
      var brow = by * w;
      for (var bx = 0; bx < w; bx++) {
        if (head.mask[brow + bx]) baseData[(brow + bx) * 4 + 3] = 0;
      }
    }
    baseCtx.putImageData(baseId, 0, 0);

    var baseBounds = alphaBounds(baseData, w, h);
    var baseCrop = cropCanvas(baseCanvas, baseBounds);
    var basePart = {
      url: baseCrop.toDataURL('image/png'),
      x: baseBounds.x, y: baseBounds.y, w: baseBounds.w, h: baseBounds.h
    };

    var root = document.createElement('div');
    root.className = 'pet-rig';
    var body = document.createElement('div');
    body.className = 'rig-body';
    root.appendChild(body);

    body.appendChild(makeImg(basePart, 'rig-base'));

    var partEls = { bodyEl: body };
    function addArm(side, armPart, forePart, shoulder, elbow) {
      if (!armPart) return 1;
      var armEl = makePartEl(armPart, 'rig-arm rig-arm-' + side, shoulder, body);
      var sign = (shoulder.x >= (side === 'a' ? shR.x : shL.x)) ? 1 : -1;
      armEl.style.setProperty('--out', String(sign));
      partEls['arm' + side.toUpperCase()] = armEl;
      if (forePart) {
        var foreEl = makePartEl(forePart, 'rig-fore rig-fore-' + side, elbow, armEl);
        foreEl.style.setProperty('--out', String(sign));
        partEls['fore' + side.toUpperCase()] = foreEl;
      }
      return sign;
    }
    var outA = addArm('a', armAPart, foreAPart, shL, elL);
    var outB = addArm('b', armBPart, foreBPart, shR, elR);

    if (chestPart) partEls.chest = makePartEl(chestPart, 'rig-chest', hipMid, body);
    if (legLPart) partEls.legL = makePartEl(legLPart, 'rig-leg rig-leg-l', hipL, body);
    if (legRPart) partEls.legR = makePartEl(legRPart, 'rig-leg rig-leg-r', hipR, body);

    partEls.head = makePartEl(headPart, 'rig-head', neck, body);

    // Decode every piece before the caller swaps it in, so the pet never
    // flashes an incomplete doll.
    var urls = [basePart.url, headPart.url];
    [armAPart, armBPart, foreAPart, foreBPart, chestPart, legLPart, legRPart].forEach(function (p) {
      if (p) urls.push(p.url);
    });

    var handle = {
      el: root,
      body: body,
      parts: partEls,
      width: w,
      height: h,
      work: work,
      outA: outA,
      outB: outB,
      landmarks: {
        nose: nose, neck: neck, shL: shL, shR: shR, elL: elL, elR: elR,
        wrL: wrL, wrR: wrR, hipL: hipL, hipR: hipR
      },
      _duration: 0,
      _disposed: false,
      _masks: (function () {
        var union = new Uint8Array(w * h);
        masks.forEach(function (m) {
          for (var i = 0; i < m.length; i++) if (m[i]) union[i] = 255;
        });
        return {
          head: maskToURL(head.mask, w, h),
          armA: armA ? maskToURL(armA.mask, w, h) : null,
          armB: armB ? maskToURL(armB.mask, w, h) : null,
          foreA: foreA ? maskToURL(foreA.mask, w, h) : null,
          foreB: foreB ? maskToURL(foreB.mask, w, h) : null,
          chest: chestPart ? maskToURL(chest.mask, w, h) : null,
          legL: legLPart ? maskToURL(legL.mask, w, h) : null,
          legR: legRPart ? maskToURL(legR.mask, w, h) : null,
          union: maskToURL(union, w, h)
        };
      })(),
      layout: layoutRig,
      setAnim: setRigAnim,
      destroy: function () {
        handle._disposed = true;
        if (root.parentNode) root.parentNode.removeChild(root);
        body.innerHTML = '';
      }
    };

    return Promise.all(urls.map(function (u) {
      return loadImage(u).catch(function () { return null; });
    })).then(function () {
      return handle;
    });
  }

  function layoutRig() {
    var handle = this;
    if (!handle || handle._disposed) return;
    var parent = handle.el.parentElement;
    if (!parent) return;
    var pw = parent.clientWidth || parent.offsetWidth;
    var ph = parent.clientHeight || parent.offsetHeight;
    if (!pw || !ph) return;
    var s = Math.min(pw / handle.width, ph / handle.height) * 0.985;
    var dispW = handle.width * s;
    var dispH = handle.height * s;
    handle.el.style.width = handle.width + 'px';
    handle.el.style.height = handle.height + 'px';
    handle.el.style.left = ((pw - dispW) / 2) + 'px';
    handle.el.style.top = (ph - dispH) + 'px';
    handle.el.style.transformOrigin = '0 0';
    handle.el.style.transform = 'scale(' + s + ')';
    handle._scale = s;
  }

  function setRigAnim(name) {
    var handle = this;
    if (!handle || handle._disposed) return;
    var el = handle.el;
    el.classList.remove('anim-idle', 'anim-happy', 'anim-shy', 'anim-angry',
      'anim-surprised', 'anim-eating', 'anim-sleeping', 'anim-thinking',
      'anim-held', 'anim-walk', 'anim-stretch', 'anim-hop', 'anim-spin',
      'anim-shake', 'anim-look', 'anim-wave', 'anim-doze');
    void el.offsetWidth;
    el.classList.add('anim-idle');
    if (name && name !== 'idle') el.classList.add('anim-' + name);
    handle._anim = name;
  }

  // ---------- public API ----------
  function create(src) {
    if (!src) return Promise.reject(new Error('no image'));
    if (/^data:image\/gif/i.test(src) || /\.gif($|\?)/i.test(src)) {
      return Promise.reject(new Error('animated gif'));
    }
    return loadImage(src).then(function (img) {
      return getLandmarker().then(function (landmarker) {
        var workCanvas = prepareWork(img).canvas;
        var result = landmarker.detect(workCanvas);
        var pts = result && result.landmarks && result.landmarks[0];
        if (!pts || pts.length < 25) throw new Error('no pose detected');
        return createRig(img, pts);
      });
    });
  }

  function warmup() {
    return getLandmarker().catch(function () {});
  }

  window.PetRig = {
    create: create,
    warmup: warmup,
    isAvailable: function () {
      return !!(window.Vision && window.Vision.PoseLandmarker);
    }
  };
})();
