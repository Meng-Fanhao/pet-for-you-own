// Copyright (c) 2026 孟凡皓 (cn.bj). All rights reserved.
// IPC wrapper using __TAURI_INTERNALS__ (the only stable entry point in Tauri v2)
var isTauri = typeof window.__TAURI_INTERNALS__ !== 'undefined';

function invoke(cmd, args) {
  if (!args) args = {};
  if (isTauri) {
    return window.__TAURI_INTERNALS__.invoke(cmd, args);
  }
  // LocalStorage fallback for browser dev
  return _lsFallback(cmd, args);
}

function toLoadableUrl(pathOrUrl) {
  if (!pathOrUrl) return null;
  if (pathOrUrl.indexOf('data:') === 0) return pathOrUrl;
  if (pathOrUrl.indexOf('http') === 0) return pathOrUrl;
  if (isTauri) {
    return window.__TAURI_INTERNALS__.convertFileSrc(pathOrUrl);
  }
  return pathOrUrl;
}

function _lsFallback(cmd, args) {
  switch (cmd) {
    case 'load_config': {
      var raw = localStorage.getItem('pet-config');
      return Promise.resolve(raw ? JSON.parse(raw) : { pet_image_path: null, window_x: 0, window_y: 0, autostart_enabled: false, sleep_mode: false });
    }
    case 'save_config': {
      var cur = JSON.parse(localStorage.getItem('pet-config') || '{}');
      Object.assign(cur, args);
      localStorage.setItem('pet-config', JSON.stringify(cur));
      return Promise.resolve(null);
    }
    case 'get_app_data_dir': return Promise.resolve('/app-data');
    case 'toggle_visibility': return Promise.resolve(true);
    case 'set_autostart': return Promise.resolve(null);
    case 'get_autostart_status': return Promise.resolve(false);
    case 'chat_with_pet': return Promise.resolve('(browser mode) Hello!');
    case 'poll_speech_bubble': return Promise.resolve(null);
    case 'clear_conversation': return Promise.resolve(null);
    default: return Promise.resolve(null);
  }
}
