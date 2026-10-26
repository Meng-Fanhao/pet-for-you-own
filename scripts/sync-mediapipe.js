// Copies the MediaPipe Tasks Vision runtime from node_modules into the static
// frontend, so the app can load it without a bundler and stay offline.
// Run after `npm install` or when upgrading @mediapipe/tasks-vision:
//   npm run sync:mediapipe
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'node_modules', '@mediapipe', 'tasks-vision');
const dst = path.join(root, 'src', 'vendor', 'mediapipe');

const files = [
  ['vision_bundle.js', 'vision_bundle.js'],
  ['wasm/vision_wasm_internal.js', 'wasm/vision_wasm_internal.js'],
  ['wasm/vision_wasm_internal.wasm', 'wasm/vision_wasm_internal.wasm'],
  ['wasm/vision_wasm_nosimd_internal.js', 'wasm/vision_wasm_nosimd_internal.js'],
  ['wasm/vision_wasm_nosimd_internal.wasm', 'wasm/vision_wasm_nosimd_internal.wasm']
];

fs.mkdirSync(path.join(dst, 'wasm'), { recursive: true });
for (const [from, to] of files) {
  const source = path.join(src, from);
  if (!fs.existsSync(source)) {
    console.error('Missing ' + source + ' — run npm install first.');
    process.exit(1);
  }
  fs.copyFileSync(source, path.join(dst, to));
  console.log('copied ' + to);
}
console.log('MediaPipe assets synced to src/vendor/mediapipe');
