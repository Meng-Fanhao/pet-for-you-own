// Copyright (c) 2026 孟凡皓 (cn.bj). All rights reserved.
// One-click person cutout using MediaPipe Selfie Segmenter (Apache-2.0).
// The WASM runtime, model and image pipeline all run locally: no network is
// used after the app is installed.
//
// Requires vendor/mediapipe/vision_bundle.js to be loaded first (it exposes
// the global `Vision`).

(function () {
  'use strict';

  var MEDIA_PIPE_WASM = 'vendor/mediapipe/wasm';
  var MODEL_PATH = 'assets/models/selfie_segmenter.tflite';
  var MAX_WORK_SIDE = 1024;   // cap before compositing to keep memory sane
  var MAX_OUTPUT_SIDE = 512;  // same limit as the existing image pipeline

  var segmenterPromise = null;
  var segmenter = null;

  function loadSegmenter(onProgress) {
    if (segmenterPromise) return segmenterPromise;

    segmenterPromise = (async function () {
      if (!window.Vision || !window.Vision.FilesetResolver) {
        throw new Error('MediaPipe runtime not loaded');
      }
      if (onProgress) onProgress('loading-engine');
      var fileset = await window.Vision.FilesetResolver.forVisionTasks(MEDIA_PIPE_WASM);
      if (onProgress) onProgress('loading-model');

      var options = {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'GPU' },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false
      };

      try {
        segmenter = await window.Vision.ImageSegmenter.createFromOptions(fileset, options);
      } catch (gpuError) {
        // WebGL can be unavailable/blocked in some webviews; CPU is plenty
        // fast for a 256x256 segmentation model.
        options.baseOptions.delegate = 'CPU';
        segmenter = await window.Vision.ImageSegmenter.createFromOptions(fileset, options);
      }
      return segmenter;
    })().catch(function (error) {
      segmenterPromise = null;
      segmenter = null;
      throw error;
    });

    return segmenterPromise;
  }

  function smoothstep(edge0, edge1, x) {
    var t = (x - edge0) / (edge1 - edge0);
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return t * t * (3 - 2 * t);
  }

  // 3-tap [1,2,1]/4 separable blur on a grayscale alpha buffer.
  function blurAlpha(src, width, height) {
    var tmp = new Uint8ClampedArray(src.length);
    var out = new Uint8ClampedArray(src.length);
    var x, y, i;
    for (y = 0; y < height; y++) {
      for (x = 0; x < width; x++) {
        i = y * width + x;
        var l = x > 0 ? src[i - 1] : src[i];
        var r = x + 1 < width ? src[i + 1] : src[i];
        tmp[i] = (l + src[i] * 2 + r) >> 2;
      }
    }
    for (y = 0; y < height; y++) {
      for (x = 0; x < width; x++) {
        i = y * width + x;
        var u = y > 0 ? tmp[i - width] : tmp[i];
        var d = y + 1 < height ? tmp[i + width] : tmp[i];
        out[i] = (u + tmp[i] * 2 + d) >> 2;
      }
    }
    return out;
  }

  function sourceSize(source) {
    return {
      width: source.naturalWidth || source.videoWidth || source.width,
      height: source.naturalHeight || source.videoHeight || source.height
    };
  }

  /**
   * Cut the person out of `source` (HTMLImageElement/Canvas/ImageBitmap).
   * Returns { canvas, dataUrl, blob, width, height }.
   * onProgress(state) receives 'loading-engine' / 'loading-model' / 'cutting'.
   */
  async function cutoutPerson(source, onProgress) {
    if (!source) throw new Error('No image source');
    await loadSegmenter(onProgress);
    if (onProgress) onProgress('cutting');

    var result = segmenter.segment(source);
    var masks = result.confidenceMasks || [];
    var category = result.categoryMask || null;
    var mask = masks.length ? masks[masks.length - 1] : null;

    var maskWidth, maskHeight, alpha;
    if (mask) {
      maskWidth = mask.width;
      maskHeight = mask.height;
      var raw = mask.getAsFloat32Array();
      if (!raw || raw.length !== maskWidth * maskHeight) {
        throw new Error('Unexpected mask size');
      }
      alpha = new Uint8ClampedArray(raw.length);
      for (var i = 0; i < raw.length; i++) {
        // Contrast curve: discard very low confidence, then feather the rest.
        alpha[i] = Math.round(smoothstep(0.06, 0.82, raw[i]) * 255);
      }
    } else if (category) {
      maskWidth = category.width;
      maskHeight = category.height;
      var cats = category.getAsUint8Array();
      alpha = new Uint8ClampedArray(cats.length);
      for (var j = 0; j < cats.length; j++) alpha[j] = cats[j] > 0 ? 255 : 0;
    } else {
      throw new Error('No segmentation mask returned');
    }

    var size = sourceSize(source);
    if (!size.width || !size.height) throw new Error('Invalid image size');

    // Find the foreground bounding box from the mask.
    var minX = maskWidth, minY = maskHeight, maxX = -1, maxY = -1;
    var fgCount = 0;
    for (var y = 0; y < maskHeight; y++) {
      for (var x = 0; x < maskWidth; x++) {
        if (alpha[y * maskWidth + x] > 24) {
          fgCount++;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (fgCount < maskWidth * maskHeight * 0.002 || maxX < minX || maxY < minY) {
      closeMasks(masks, category);
      throw new Error('No person detected');
    }

    // Feather the mask edges before compositing.
    alpha = blurAlpha(alpha, maskWidth, maskHeight);

    var maskCanvas = document.createElement('canvas');
    maskCanvas.width = maskWidth;
    maskCanvas.height = maskHeight;
    var mctx = maskCanvas.getContext('2d');
    var imageData = mctx.createImageData(maskWidth, maskHeight);
    for (var p = 0; p < alpha.length; p++) {
      var o = p * 4;
      imageData.data[o] = 255;
      imageData.data[o + 1] = 255;
      imageData.data[o + 2] = 255;
      imageData.data[o + 3] = alpha[p];
    }
    mctx.putImageData(imageData, 0, 0);

    // Composite the source with the mask at a working resolution.
    var workScale = Math.min(1, MAX_WORK_SIDE / Math.max(size.width, size.height));
    var workW = Math.max(1, Math.round(size.width * workScale));
    var workH = Math.max(1, Math.round(size.height * workScale));

    var work = document.createElement('canvas');
    work.width = workW;
    work.height = workH;
    var wctx = work.getContext('2d');
    wctx.imageSmoothingEnabled = true;
    wctx.imageSmoothingQuality = 'high';
    wctx.drawImage(source, 0, 0, workW, workH);
    wctx.globalCompositeOperation = 'destination-in';
    wctx.drawImage(maskCanvas, 0, 0, workW, workH);
    wctx.globalCompositeOperation = 'source-over';

    // Crop to the person (plus a little padding) and scale down.
    var sx = workW / maskWidth;
    var sy = workH / maskHeight;
    var bx = minX * sx;
    var by = minY * sy;
    var bw = (maxX - minX + 1) * sx;
    var bh = (maxY - minY + 1) * sy;
    var pad = Math.max(4, Math.round(Math.max(bw, bh) * 0.03));
    bx = Math.max(0, bx - pad);
    by = Math.max(0, by - pad);
    bw = Math.min(workW - bx, bw + pad * 2);
    bh = Math.min(workH - by, bh + pad * 2);

    var outScale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(bw, bh));
    var outW = Math.max(1, Math.round(bw * outScale));
    var outH = Math.max(1, Math.round(bh * outScale));

    var out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    var octx = out.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(work, bx, by, bw, bh, 0, 0, outW, outH);

    closeMasks(masks, category);

    var blob = await new Promise(function (resolve) {
      out.toBlob(resolve, 'image/png');
    });
    if (!blob) throw new Error('Failed to encode PNG');

    return {
      canvas: out,
      blob: blob,
      dataUrl: out.toDataURL('image/png'),
      width: outW,
      height: outH
    };
  }

  function closeMasks(masks, category) {
    if (masks) {
      for (var i = 0; i < masks.length; i++) {
        if (masks[i] && masks[i].close) {
          try { masks[i].close(); } catch (e) { /* ignore */ }
        }
      }
    }
    if (category && category.close) {
      try { category.close(); } catch (e) { /* ignore */ }
    }
  }

  window.PetCutout = {
    warmup: function () {
      return loadSegmenter().catch(function () { return null; });
    },
    cutoutPerson: cutoutPerson,
    isReady: function () { return segmenter !== null; }
  };
})();
