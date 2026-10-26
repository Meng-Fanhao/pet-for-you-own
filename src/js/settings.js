// Copyright (c) 2026 孟凡皓 (cn.bj). All rights reserved.

// --- i18n ---
var LANG = {
  en: {
    title: 'Desktop Pet Settings',
    appearance: 'Pet Appearance',
    current_image: 'Current Pet Image:',
    change_image: 'Change Image',
    reset_default: 'Reset to Default',
    one_click_cutout: 'One-click Cutout',
    cutout_hint: 'Photos are cut out automatically after upload. GIF is not supported.',
    cutout_auto: 'Auto-cutting the uploaded photo...',
    cutout_auto_no_person: 'No person detected. The original image was kept.',
    cutout_wait_save: 'Cutout is still running. Please wait.',
    cutout_need_image: 'Select a photo first.',
    cutout_gif_unsupported: 'GIF is not supported for cutout. Choose a PNG/JPG photo.',
    cutout_loading: 'Preparing cutout...',
    cutout_engine: 'Loading cutout engine (first run takes a few seconds)...',
    cutout_model: 'Loading person model...',
    cutout_cutting: 'Cutting out the person...',
    cutout_done: 'Cutout done. Click "Save Settings" to apply.',
    cutout_failed: 'Cutout failed',
    cutout_no_person: 'No person detected. Try a clearer photo.',
    interaction_title: 'Interaction',
    pet_size_label: 'Pet size:',
    random_actions_label: 'Random actions',
    wander_label: 'Screen wandering',
    throw_power_label: 'Throw power:',
    bounce_label: 'Bounce:',
    language_title: 'Language',
    language_label: 'Interface Language:',
    startup: 'Startup',
    autostart_label: 'Auto-start with system:',
    controls: 'Controls',
    toggle_pet: 'Show/Hide Pet',
    save: 'Save Settings',
    hint: 'Click to interact, drag and fling the pet, hover to pet it. Right-click for the action menu.',
    copyright: 'Copyright © 2026 孟凡皓. All rights reserved.',
    processing: 'Processing image...',
    image_ready: 'Image ready ({size}KB). Click "Save Settings" to apply.',
    reset_ready: 'Reset to default. Click "Save Settings" to apply.',
    save_success: 'Settings saved successfully!',
    save_failed: 'Save failed',
    autostart_saved: 'Auto-start setting saved.',
    autostart_failed: 'Failed to save auto-start setting.',
    process_failed: 'Failed to process image.',
    no_changes: 'No changes to save.',
    lang_saved: 'Language changed. Click "Save Settings" to apply.',
    ai_chat_title: 'AI Voice Chat',
    provider_label: 'AI Provider:',
    coze_pat_label: 'Coze PAT:',
    coze_bot_label: 'Coze Bot ID:',
    api_key_label: 'DeepSeek API Key:',
    persona_label: 'Pet Persona:',
    persona_default: 'You are a cute desktop pet companion. Be playful, friendly, and keep responses very short.',
    memory_label: 'Conversation Memory (turns):',
    chat_history_title: 'Chat History',
    chat_empty: 'No messages yet. Type or use the mic on the pet.',
    chat_placeholder: 'Type a message...',
    chat_clear: 'Clear',
    chat_send: 'Send',
    chat_thinking: 'Pet is thinking...'
  },
  zh: {
    title: '桌面宠物设置',
    appearance: '宠物外观',
    current_image: '当前宠物图片：',
    change_image: '更换图片',
    reset_default: '恢复默认',
    one_click_cutout: '一键抠图',
    cutout_hint: '上传照片后会自动抠图；GIF 不支持。',
    cutout_auto: '正在自动抠图…',
    cutout_auto_no_person: '未检测到人物，已保留原图。',
    cutout_wait_save: '抠图仍在处理中，请稍候。',
    cutout_need_image: '请先选择一张照片。',
    cutout_gif_unsupported: 'GIF 暂不支持一键抠图，请选择 PNG/JPG 照片。',
    cutout_loading: '正在准备抠图…',
    cutout_engine: '正在加载抠图引擎（首次较慢）…',
    cutout_model: '正在加载人物模型…',
    cutout_cutting: '正在抠图…',
    cutout_done: '抠图完成，点击“保存设置”生效。',
    cutout_failed: '抠图失败',
    cutout_no_person: '没有检测到人物，请换一张更清晰的照片。',
    interaction_title: '互动',
    pet_size_label: '宠物大小：',
    random_actions_label: '随机动作',
    wander_label: '屏幕漫游',
    throw_power_label: '拖拽甩出力度：',
    bounce_label: '碰撞弹性：',
    language_title: '语言',
    language_label: '界面语言：',
    startup: '开机启动',
    autostart_label: '开机自动启动：',
    controls: '控制',
    toggle_pet: '显示/隐藏宠物',
    save: '保存设置',
    hint: '点击互动，拖拽甩出宠物，鼠标悬停抚摸；右键打开动作菜单。',
    copyright: 'Copyright © 2026 孟凡皓. All rights reserved.',
    processing: '正在处理图片...',
    image_ready: '图片已准备好 ({size}KB)，点击“保存设置”生效。',
    reset_ready: '已恢复默认，点击“保存设置”生效。',
    save_success: '设置保存成功！',
    save_failed: '保存失败',
    autostart_saved: '开机自启动设置已保存。',
    autostart_failed: '保存开机自启动设置失败。',
    process_failed: '图片处理失败。',
    no_changes: '没有变更需要保存。',
    lang_saved: '语言已更改，点击“保存设置”生效。',
    ai_chat_title: 'AI 语音聊天',
    provider_label: 'AI 供应商：',
    coze_pat_label: 'Coze 访问令牌：',
    coze_bot_label: 'Coze Bot ID：',
    api_key_label: 'DeepSeek API 密钥：',
    persona_label: '宠物性格设定：',
    persona_default: '你是一只可爱的桌面宠物。回复要简短俏皮，保持宠物性格，不要说自己是AI。',
    memory_label: '对话记忆轮数：',
    chat_history_title: '对话历史',
    chat_empty: '暂无消息。输入文字或点击宠物上的麦克风开始对话。',
    chat_placeholder: '输入消息...',
    chat_clear: '清空',
    chat_send: '发送',
    chat_thinking: '宠物正在思考...'
  }
};

var currentLang = 'en';

function t(key, params) {
  var s = (LANG[currentLang] && LANG[currentLang][key]) || (LANG.en[key]) || key;
  if (params) {
    for (var k in params) {
      s = s.replace('{' + k + '}', params[k]);
    }
  }
  return s;
}

function applyLanguage(lang) {
  currentLang = lang || 'en';
  document.documentElement.lang = currentLang;
  var els = document.querySelectorAll('[data-i18n]');
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    var key = el.getAttribute('data-i18n');
    if (el.tagName === 'INPUT' && el.type === 'button') {
      el.value = t(key);
    } else if (el.tagName === 'BUTTON' || el.tagName === 'LABEL' && el.classList.contains('toggle-switch')) {
      el.childNodes.forEach(function (node) {
        if (node.nodeType === 3 && node.textContent.trim()) { node.textContent = ' ' + t(key) + ' '; }
      });
      if (el.textContent.trim() && !el.querySelector('*')) {
        el.textContent = t(key);
      }
    } else {
      el.textContent = t(key);
    }
  }
  // Update dynamic status if present
  if (languageSelect) languageSelect.value = currentLang;
}

// --- Tauri IPC helpers ---
var _isTauri = typeof window.__TAURI_INTERNALS__ !== 'undefined';

function _invoke(cmd, args) {
  if (!args) args = {};
  if (_isTauri) {
    return window.__TAURI_INTERNALS__.invoke(cmd, args);
  }
  if (cmd === 'load_config') {
    var raw = localStorage.getItem('pet-config');
    return Promise.resolve(raw ? JSON.parse(raw) : { pet_image_path: null, window_x: 0, window_y: 0, autostart_enabled: false, sleep_mode: false, language: 'en' });
  }
  if (cmd === 'save_config') {
    var cur = JSON.parse(localStorage.getItem('pet-config') || '{}');
    if (args.payload) { Object.assign(cur, args.payload); }
    localStorage.setItem('pet-config', JSON.stringify(cur));
    return Promise.resolve(null);
  }
  if (cmd === 'load_pet_image_url') return Promise.resolve('');
  if (cmd === 'get_app_data_dir') return Promise.resolve('/app-data');
  if (cmd === 'set_autostart') return Promise.resolve(null);
  if (cmd === 'get_autostart_status') return Promise.resolve(false);
  if (cmd === 'toggle_visibility') return Promise.resolve(true);
  return Promise.resolve(null);
}

// --- DOM ---
var previewImage = document.getElementById('preview-image');
var pickImageBtn = document.getElementById('pick-image-btn');
var imageFileInput = document.getElementById('image-file-input');
var resetImageBtn = document.getElementById('reset-image-btn');
var cutoutBtn = document.getElementById('cutout-btn');
var cutoutStatus = document.getElementById('cutout-status');
var autostartToggle = document.getElementById('autostart-toggle');
var togglePetBtn = document.getElementById('toggle-pet-btn');
var saveBtn = document.getElementById('save-btn');
var saveStatus = document.getElementById('save-status');
var languageSelect = document.getElementById('language-select');
var petSizeInput = document.getElementById('pet-size-input');
var petSizeValue = document.getElementById('pet-size-value');
var randomActionsToggle = document.getElementById('random-actions-toggle');
var wanderToggle = document.getElementById('wander-toggle');
var throwPowerInput = document.getElementById('throw-power-input');
var throwPowerValue = document.getElementById('throw-power-value');
var bounceInput = document.getElementById('bounce-input');
var bounceValue = document.getElementById('bounce-value');
var providerSelect = document.getElementById('provider-select');
var cozePatInput = document.getElementById('coze-pat-input');
var cozeBotInput = document.getElementById('coze-bot-input');
var apiKeyInput = document.getElementById('api-key-input');
var personaInput = document.getElementById('persona-input');
var memoryInput = document.getElementById('memory-input');
var chatMessages = document.getElementById('chat-messages');
var chatTextInput = document.getElementById('chat-text-input');
var chatSendBtn = document.getElementById('chat-send-btn');
var chatClearBtn = document.getElementById('chat-clear-btn');

var DEFAULT_IMAGE = 'assets/default-pet.svg';
var MAX_IMAGE_SIZE = 512;
var MAX_GIF_SIZE = 2048; // KB, GIFs can't be resized so allow larger

var pendingBytes = null;
var pendingExt = 'jpg';
// Original uploaded image (before cutout), so repeated cutouts always start
// from the uncropped photo.
var lastSourceSrc = null;
// Invalidates in-flight image processing / cutouts when a new image is picked.
var pickRunId = 0;
var cutoutRunId = 0;
var cutoutBusy = false;
var initialLang = 'en';
var pendingLang = 'en';

// --- Init ---
function init() {
  pickImageBtn.addEventListener('click', function () { imageFileInput.click(); });
  imageFileInput.addEventListener('change', handleImagePick);
  resetImageBtn.addEventListener('click', handleResetImage);
  if (cutoutBtn) cutoutBtn.addEventListener('click', handleCutout);
  autostartToggle.addEventListener('change', handleAutostartChange);
  togglePetBtn.addEventListener('click', handleTogglePet);
  saveBtn.addEventListener('click', handleSave);
  languageSelect.addEventListener('change', function () {
    pendingLang = languageSelect.value;
    applyLanguage(pendingLang);
    showStatus(t('lang_saved'), 'info');
  });
  if (petSizeInput) {
    petSizeInput.addEventListener('input', function () {
      petSizeValue.textContent = petSizeInput.value + 'px';
    });
  }
  if (throwPowerInput) {
    throwPowerInput.addEventListener('input', function () {
      throwPowerValue.textContent = parseFloat(throwPowerInput.value).toFixed(1) + 'x';
    });
  }
  if (bounceInput) {
    bounceInput.addEventListener('input', function () {
      bounceValue.textContent = parseFloat(bounceInput.value).toFixed(2);
    });
  }
  if (providerSelect) {
    providerSelect.addEventListener('change', function () {
      toggleProviderFields();
    });
  }
  if (chatSendBtn) chatSendBtn.addEventListener('click', sendTextChat);
  if (chatTextInput) chatTextInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendTextChat();
  });
  if (chatClearBtn) chatClearBtn.addEventListener('click', clearHistory);
  loadCurrentSettings();
  loadChatHistory();
}

function toggleProviderFields() {
  var prov = providerSelect ? providerSelect.value : 'coze';
  var cozeDiv = document.getElementById('coze-fields');
  var dsDiv = document.getElementById('deepseek-fields');
  if (prov === 'coze') {
    if (cozeDiv) cozeDiv.style.display = '';
    if (dsDiv) dsDiv.style.display = 'none';
  } else {
    if (cozeDiv) cozeDiv.style.display = 'none';
    if (dsDiv) dsDiv.style.display = '';
  }
}

function loadCurrentSettings() {
  _invoke('load_pet_image_url').then(function (dataUrl) {
    if (dataUrl) previewImage.src = dataUrl;
  }).catch(function () {});
  _invoke('load_config').then(function (config) {
    autostartToggle.checked = config.autostart_enabled || false;
    initialLang = config.language || 'en';
    pendingLang = initialLang;
    applyLanguage(pendingLang);
    // Interaction settings
    if (petSizeInput) {
      var size = config.pet_size || 256;
      petSizeInput.value = size;
      if (petSizeValue) petSizeValue.textContent = size + 'px';
    }
    if (randomActionsToggle) randomActionsToggle.checked = config.random_actions_enabled !== false;
    if (wanderToggle) wanderToggle.checked = config.wander_enabled !== false;
    if (throwPowerInput) {
      var power = typeof config.throw_power === 'number' ? config.throw_power : 1;
      throwPowerInput.value = power;
      if (throwPowerValue) throwPowerValue.textContent = parseFloat(power).toFixed(1) + 'x';
    }
    if (bounceInput) {
      var bounce = typeof config.bounce === 'number' ? config.bounce : 0.78;
      bounceInput.value = bounce;
      if (bounceValue) bounceValue.textContent = parseFloat(bounce).toFixed(2);
    }
    // AI chat fields
    if (providerSelect) { providerSelect.value = config.ai_provider || 'coze'; toggleProviderFields(); }
    if (apiKeyInput) apiKeyInput.value = config.deepseek_api_key || '';
    if (cozePatInput) cozePatInput.value = config.coze_pat || '';
    if (cozeBotInput) cozeBotInput.value = config.coze_bot_id || '';
    if (personaInput) personaInput.value = config.pet_persona || '';
    if (memoryInput) memoryInput.value = config.conversation_memory || 10;
  }).catch(function () {});
}

function processImage(file) {
  var isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
  var isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');

  if (isGif) {
    // GIF: skip canvas to preserve animation, pass raw bytes
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var bytes = new Uint8Array(reader.result);
        if (bytes.length > MAX_GIF_SIZE * 1024) {
          reject(new Error('GIF too large. Max ' + MAX_GIF_SIZE + 'KB.'));
          return;
        }
        resolve({ dataUrl: URL.createObjectURL(file), bytes: bytes, ext: 'gif' });
      };
      reader.onerror = function () { reject(new Error('Failed to read file')); };
      reader.readAsArrayBuffer(file);
    });
  }

  return new Promise(function (resolve, reject) {
    var img = new Image();
    var blobUrl = URL.createObjectURL(file);
    img.onload = function () {
      URL.revokeObjectURL(blobUrl);
      var w = img.width, h = img.height;
      var canvas = document.createElement('canvas');
      if (w <= MAX_IMAGE_SIZE && h <= MAX_IMAGE_SIZE) {
        canvas.width = w; canvas.height = h;
      } else {
        var scale = Math.min(MAX_IMAGE_SIZE / w, MAX_IMAGE_SIZE / h);
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
      }
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      var mime = isPng ? 'image/png' : 'image/jpeg';
      var quality = isPng ? undefined : 0.7;
      var dataUrl = canvas.toDataURL(mime, quality);
      canvas.toBlob(function (blob) {
        blob.arrayBuffer().then(function (buf) {
          resolve({ dataUrl: dataUrl, bytes: new Uint8Array(buf), ext: isPng ? 'png' : 'jpg' });
        });
      }, mime, quality);
    };
    img.onerror = function () { reject(new Error('Failed to load image')); };
    img.src = blobUrl;
  });
}

function handleImagePick() {
  var file = imageFileInput.files[0];
  if (!file) return;

  var myPick = ++pickRunId;
  cutoutRunId++; // invalidate any in-flight cutout
  cutoutBusy = false;
  if (cutoutBtn) cutoutBtn.disabled = false;
  if (saveBtn) saveBtn.disabled = false;
  showCutoutStatus('', '');
  saveStatus.textContent = t('processing');
  saveStatus.className = 'status-message';

  processImage(file).then(function (result) {
    if (myPick !== pickRunId) return; // a newer file was picked meanwhile

    pendingBytes = result.bytes;
    pendingExt = result.ext;
    lastSourceSrc = result.dataUrl;
    previewImage.src = result.dataUrl;
    saveStatus.textContent = t('image_ready', { size: (result.bytes.length / 1024).toFixed(0) });
    saveStatus.className = 'status-message info';

    if (result.ext === 'gif') {
      showCutoutStatus(t('cutout_gif_unsupported'), 'info');
      return;
    }
    // Auto-cutout on upload. On failure pendingBytes keeps the original image.
    handleCutout(true);
  }).catch(function () {
    if (myPick !== pickRunId) return;
    saveStatus.textContent = t('process_failed');
    saveStatus.className = 'status-message error';
  });
}

function handleResetImage() {
  pickRunId++;
  cutoutRunId++;
  cutoutBusy = false;
  lastSourceSrc = null;
  previewImage.src = DEFAULT_IMAGE;
  pendingBytes = null;
  pendingExt = 'jpg';
  showCutoutStatus('', '');
  if (cutoutBtn) cutoutBtn.disabled = false;
  if (saveBtn) saveBtn.disabled = false;
  saveStatus.textContent = t('reset_ready');
  saveStatus.className = 'status-message info';
}

function loadImageElement(src) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.onload = function () { resolve(img); };
    img.onerror = function () { reject(new Error('Failed to load image')); };
    img.src = src;
  });
}

async function handleCutout(auto) {
  if (!cutoutBtn) return;

  var src = lastSourceSrc || previewImage.src || '';
  if (!src || src.indexOf(DEFAULT_IMAGE) !== -1) {
    showCutoutStatus(t('cutout_need_image'), 'error');
    return;
  }
  if (pendingExt === 'gif' || src.indexOf('data:image/gif') === 0) {
    showCutoutStatus(t('cutout_gif_unsupported'), 'error');
    return;
  }
  if (!window.PetCutout) {
    showCutoutStatus(t('cutout_failed') + ': MediaPipe runtime missing', 'error');
    return;
  }

  var myRun = ++cutoutRunId;
  cutoutBusy = true;
  cutoutBtn.disabled = true;
  if (saveBtn) saveBtn.disabled = true;
  showCutoutStatus(t(auto ? 'cutout_auto' : 'cutout_loading'), 'info');

  try {
    // Always segment the original upload, never a previous cutout.
    var source = previewImage;
    if (lastSourceSrc && lastSourceSrc !== previewImage.src) {
      source = await loadImageElement(lastSourceSrc);
    }
    if (source.decode) {
      try { await source.decode(); } catch (e) { /* already decoded */ }
    }

    var result = await window.PetCutout.cutoutPerson(source, function (state) {
      if (myRun !== cutoutRunId) return;
      if (state === 'loading-engine') showCutoutStatus(t('cutout_engine'), 'info');
      else if (state === 'loading-model') showCutoutStatus(t('cutout_model'), 'info');
      else showCutoutStatus(t('cutout_cutting'), 'info');
    });

    if (myRun !== cutoutRunId) return;
    var buffer = await result.blob.arrayBuffer();
    if (myRun !== cutoutRunId) return;

    pendingBytes = new Uint8Array(buffer);
    pendingExt = 'png';
    previewImage.src = result.dataUrl;
    showCutoutStatus(t('cutout_done') + ' (' + result.width + '×' + result.height + ')', 'success');
  } catch (e) {
    if (myRun !== cutoutRunId) return;
    var message = e && e.message ? e.message : String(e);
    if (message === 'No person detected') {
      showCutoutStatus(t(auto ? 'cutout_auto_no_person' : 'cutout_no_person'), 'error');
    } else {
      showCutoutStatus(t('cutout_failed') + ': ' + message, 'error');
    }
  } finally {
    if (myRun === cutoutRunId) {
      cutoutBusy = false;
      cutoutBtn.disabled = false;
      if (saveBtn) saveBtn.disabled = false;
    }
  }
}

function showCutoutStatus(message, type) {
  if (!cutoutStatus) return;
  cutoutStatus.textContent = message || '';
  cutoutStatus.className = 'cutout-status' + (type ? ' ' + type : '');
}

function handleAutostartChange() {
  var enabled = autostartToggle.checked;
  _invoke('set_autostart', { enabled: enabled }).then(function () {
    showStatus(t('autostart_saved'), 'success');
  }).catch(function () {
    autostartToggle.checked = !enabled;
    showStatus(t('autostart_failed'), 'error');
  });
}

function handleTogglePet() {
  _invoke('toggle_visibility').catch(function (e) { console.error(e); });
}

function handleSave() {
  if (cutoutBusy) {
    showStatus(t('cutout_wait_save'), 'info');
    return;
  }
  saveBtn.disabled = true;
  saveBtn.textContent = '...';

  Promise.resolve().then(function () {
    var tasks = [];
    if (pendingBytes != null) {
      // Uploading a new image
      tasks.push(_invoke('save_pet_image', { imageBytes: pendingBytes, ext: pendingExt }));
    }

    // Build a single config update for everything else (image reset + language)
    var payload = {};
    if (pendingBytes === null && previewImage.src.indexOf(DEFAULT_IMAGE) !== -1) {
      payload.pet_image_path = '';
    }
    if (pendingLang !== initialLang) {
      payload.language = pendingLang;
    }
    // AI chat fields
    if (providerSelect) {
      payload.ai_provider = providerSelect.value;
    }
    if (apiKeyInput && apiKeyInput.value !== '') {
      payload.deepseek_api_key = apiKeyInput.value;
    }
    if (cozePatInput && cozePatInput.value !== '') {
      payload.coze_pat = cozePatInput.value;
    }
    if (cozeBotInput && cozeBotInput.value !== '') {
      payload.coze_bot_id = cozeBotInput.value;
    }
    if (personaInput && personaInput.value !== '') {
      payload.pet_persona = personaInput.value;
    }
    if (memoryInput) {
      payload.conversation_memory = parseInt(memoryInput.value, 10) || 10;
    }
    if (petSizeInput) {
      payload.pet_size = parseInt(petSizeInput.value, 10) || 256;
    }
    if (randomActionsToggle) {
      payload.random_actions_enabled = randomActionsToggle.checked;
    }
    if (wanderToggle) {
      payload.wander_enabled = wanderToggle.checked;
    }
    if (throwPowerInput) {
      payload.throw_power = parseFloat(throwPowerInput.value) || 1;
    }
    if (bounceInput) {
      payload.bounce = parseFloat(bounceInput.value) || 0.78;
    }
    if (Object.keys(payload).length > 0) {
      tasks.push(_invoke('save_config', { payload: payload }));
    }

    if (tasks.length === 0) {
      return null;
    }
    return Promise.all(tasks);
  }).then(function () {
    if (pendingLang !== initialLang) {
      initialLang = pendingLang;
      applyLanguage(pendingLang);
    }
    showStatus(t('save_success'), 'success');
    notifyPetWindow();
  }).catch(function (e) {
    console.error('Save failed:', e);
    showStatus(t('save_failed') + ': ' + (typeof e === 'string' ? e : (e && e.message ? e.message : JSON.stringify(e))), 'error');
  }).finally(function () {
    saveBtn.disabled = false;
    saveBtn.textContent = t('save');
  });
}

function notifyPetWindow() {
  if (_isTauri) {
    _invoke('broadcast_config_updated').catch(function () {});
  }
}

// --- Text chat in settings ---
async function loadChatHistory() {
  try {
    var history = await _invoke('get_conversation_history');
    renderChatHistory(history);
  } catch (e) { /* ok */ }
}

function renderChatHistory(history) {
  if (!chatMessages) return;
  chatMessages.innerHTML = '';
  if (!history || history.length === 0) {
    chatMessages.innerHTML = '<p class="chat-empty">' + t('chat_empty') + '</p>';
    return;
  }
  for (var i = 0; i < history.length; i++) {
    var pair = history[i];
    appendChatMsg('user', pair[0]);
    appendChatMsg('pet', pair[1]);
  }
  chatMessages.parentElement.scrollTop = chatMessages.parentElement.scrollHeight;
}

function appendChatMsg(role, text) {
  if (!chatMessages) return;
  var div = document.createElement('div');
  div.className = 'chat-msg ' + role;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.parentElement.scrollTop = chatMessages.parentElement.scrollHeight;
}

async function sendTextChat() {
  if (!chatTextInput || !chatSendBtn) return;
  var text = chatTextInput.value.trim();
  if (!text) return;

  chatTextInput.value = '';
  chatTextInput.disabled = true;
  chatSendBtn.disabled = true;

  // Remove empty state
  var empty = chatMessages.querySelector('.chat-empty');
  if (empty) empty.remove();

  appendChatMsg('user', text);

  try {
    var response = await _invoke('chat_with_pet', { message: text });
    appendChatMsg('pet', response);
    _invoke('broadcast_config_updated').catch(function () {});
  } catch (e) {
    var err = typeof e === 'string' ? e : (e.message || JSON.stringify(e));
    appendChatMsg('pet', 'Error: ' + err);
  } finally {
    chatTextInput.disabled = false;
    chatSendBtn.disabled = false;
    chatTextInput.focus();
  }
}

async function clearHistory() {
  try {
    await _invoke('clear_conversation');
    if (chatMessages) {
      chatMessages.innerHTML = '<p class="chat-empty">' + t('chat_empty') + '</p>';
    }
  } catch (e) { /* ok */ }
}

function showStatus(msg, type) {
  saveStatus.textContent = msg;
  saveStatus.className = 'status-message ' + type;
  if (type === 'success') {
    setTimeout(function () {
      if (saveStatus.textContent === msg) {
        saveStatus.textContent = '';
        saveStatus.className = 'status-message';
      }
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', init);
