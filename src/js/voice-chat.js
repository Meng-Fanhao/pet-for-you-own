// Copyright (c) 2026 孟凡皓 (cn.bj). All rights reserved.
// Voice chat via OS-native mic permission (getUserMedia) + SpeechRecognition

var micBtn = null;
var speechBubble = null;
var speechText = null;
var listening = false;
var recognition = null;
var micStream = null;

function initVoiceChat() {
  micBtn = document.getElementById('mic-toggle');
  speechBubble = document.getElementById('speech-bubble');
  speechText = document.getElementById('speech-text');

  if (micBtn) {
    micBtn.addEventListener('mousedown', function (e) { e.stopPropagation(); e.preventDefault(); });
    micBtn.addEventListener('mouseup', function (e) { e.stopPropagation(); e.preventDefault(); });
    micBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      toggleMic();
    });
  }

  setInterval(checkSpeechBubble, 600);
}

function toggleMic() {
  if (listening) {
    stopListening();
  } else {
    requestMicAndStart();
  }
}

async function requestMicAndStart() {
  if (micBtn) micBtn.classList.add('listening');

  // Trigger OS-native mic permission dialog via getUserMedia
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Permission granted — now start SpeechRecognition
    startRecognition();
  } catch (e) {
    // Permission denied or no mic
    if (micBtn) micBtn.classList.remove('listening');
    if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
      showBubble('Mic access denied. Check system settings.', 4000);
    } else {
      showBubble('No microphone found.', 4000);
    }
  }
}

function startRecognition() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showBubble('Speech recognition not available. Use text chat in Settings.', 4000);
    stopListening();
    return;
  }

  try {
    if (!recognition) {
      recognition = new SR();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'zh-CN';

      recognition.onresult = function (event) {
        var t = event.results[0][0].transcript;
        if (t.trim()) sendVoiceMessage(t.trim());
      };

      recognition.onerror = function (event) {
        if (event.error === 'no-speech' || event.error === 'aborted') {
          if (listening && recognition) {
            setTimeout(function () {
              if (listening && recognition) {
                try { recognition.start(); } catch (e) { /* ok */ }
              }
            }, 300);
          }
          return;
        }
        if (event.error === 'not-allowed') {
          showBubble('Mic access denied', 3000);
        }
        stopListening();
      };

      recognition.onend = function () {
        if (listening) {
          setTimeout(function () {
            if (listening && recognition) {
              try { recognition.start(); } catch (e) { /* ok */ }
            }
          }, 200);
        }
      };
    }

    recognition.start();
    listening = true;
  } catch (e) {
    listening = false;
    if (micBtn) micBtn.classList.remove('listening');
    showBubble('Speech recognition error', 3000);
  }
}

function stopListening() {
  if (recognition) {
    try { recognition.stop(); } catch (e) { /* ok */ }
  }
  if (micStream) {
    try { micStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* ok */ }
    micStream = null;
  }
  listening = false;
  if (micBtn) micBtn.classList.remove('listening');
}

async function sendVoiceMessage(text) {
  showBubble('...', 0);
  if (window.petReaction && window.petReaction.thinking) window.petReaction.thinking(true);
  try {
    var response = await invoke('chat_with_pet', { message: text });
    showBubble(response, 0);
    if (window.petReaction && window.petReaction.happy) window.petReaction.happy();
    speakResponse(response);
  } catch (e) {
    var errMsg = typeof e === 'string' ? e : (e.message || 'Unknown error');
    showBubble(errMsg, 4000);
  } finally {
    if (window.petReaction && window.petReaction.thinking) window.petReaction.thinking(false);
  }
}

function showBubble(text, duration) {
  if (!speechBubble || !speechText) return;
  speechText.textContent = text;
  speechBubble.style.display = 'block';
  speechBubble.classList.remove('fade-out');
  clearTimeout(speechBubble._hideTimer);
  if (duration > 0) {
    speechBubble._hideTimer = setTimeout(hideBubble, duration);
  } else {
    speechBubble._hideTimer = setTimeout(hideBubble, Math.max(5000, text.length * 150));
  }
}

function hideBubble() {
  if (!speechBubble) return;
  speechBubble.classList.add('fade-out');
  clearTimeout(speechBubble._hideTimer2);
  speechBubble._hideTimer2 = setTimeout(function () {
    speechBubble.style.display = 'none';
    speechBubble.classList.remove('fade-out');
  }, 400);
}

function speakResponse(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(text);
  u.rate = 1.0;
  u.pitch = 1.15;
  u.volume = 0.8;
  var voices = window.speechSynthesis.getVoices();
  if (voices.length) setVoice(u, voices);
  window.speechSynthesis.speak(u);
}

function setVoice(u, voices) {
  for (var i = 0; i < voices.length; i++) {
    var v = voices[i];
    if (v.name.indexOf('Female') !== -1 || v.name.indexOf('Samantha') !== -1 ||
        v.name.indexOf('Tingting') !== -1 || v.lang.indexOf('zh') !== -1) {
      u.voice = v;
      return;
    }
  }
}

async function checkSpeechBubble() {
  try {
    var text = await invoke('poll_speech_bubble');
    if (text) {
      showBubble(text, 0);
      if (window.petReaction && window.petReaction.happy) window.petReaction.happy();
    }
  } catch (e) { /* ok */ }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVoiceChat);
} else {
  initVoiceChat();
}
