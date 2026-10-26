// Copyright (c) 2026 孟凡皓 (cn.bj). All rights reserved.
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};

fn default_pet_size() -> u32 { 256 }
fn default_true() -> bool { true }
fn default_throw_power() -> f64 { 1.0 }
fn default_bounce() -> f64 { 0.78 }

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub pet_image_path: Option<String>,
    pub window_x: f64,
    pub window_y: f64,
    pub autostart_enabled: bool,
    pub sleep_mode: bool,
    pub language: String,
    pub ai_provider: String,
    pub deepseek_api_key: String,
    pub coze_pat: String,
    pub coze_bot_id: String,
    pub pet_persona: String,
    pub conversation_memory: usize,
    #[serde(default = "default_pet_size")]
    pub pet_size: u32,
    #[serde(default = "default_true")]
    pub random_actions_enabled: bool,
    #[serde(default = "default_true")]
    pub wander_enabled: bool,
    #[serde(default = "default_throw_power")]
    pub throw_power: f64,
    #[serde(default = "default_bounce")]
    pub bounce: f64,
    pub app_version: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            pet_image_path: None,
            window_x: 0.0,
            window_y: 0.0,
            autostart_enabled: false,
            sleep_mode: false,
            language: "en".into(),
            ai_provider: "coze".into(),
            deepseek_api_key: String::new(),
            coze_pat: String::new(),
            coze_bot_id: String::new(),
            pet_persona: "你是一只可爱的桌面宠物。你始终用中文回复，说非常简短俏皮的句子（1-2行）。你友好、好奇，有时会发出可爱的小宠物声音。你深爱你的主人，经常表达亲昵。永远不要打破角色设定。永远不要提及你是一个AI。".into(),
            conversation_memory: 10,
            pet_size: default_pet_size(),
            random_actions_enabled: true,
            wander_enabled: true,
            throw_power: default_throw_power(),
            bounce: default_bounce(),
            app_version: String::new(),
        }
    }
}

pub struct AppState {
    pub config: Mutex<AppConfig>,
    pub config_path: PathBuf,
    pub conversation_history: Mutex<Vec<(String, String)>>,
    pub coze_conversation_id: Mutex<Option<String>>,
    pub last_speech_text: Mutex<Option<String>>,
    /// Command dispatched from the native right-click menu, polled by the pet window.
    pub pending_pet_command: Mutex<Option<String>>,
    /// Debounces the position saves triggered by every window move frame.
    pub last_position_save: Mutex<Instant>,
}

impl AppState {
    pub fn new() -> Self {
        let config_dir = get_config_dir();
        fs::create_dir_all(&config_dir).ok();
        let config_path = config_dir.join("config.json");

        let current_version = env!("CARGO_PKG_VERSION").to_string();

        let mut config = if config_path.exists() {
            fs::read_to_string(&config_path)
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default()
        } else {
            AppConfig::default()
        };

        // Clear API key on version update to prevent data leakage
        if config.app_version != current_version && !config.deepseek_api_key.is_empty() {
            config.deepseek_api_key = String::new();
        }
        config.app_version = current_version;

        // Save immediately to persist version update and key clearing
        let _ = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("{}", e))
            .and_then(|json| fs::write(&config_path, json).map_err(|e| format!("{}", e)));

        Self {
            config: Mutex::new(config),
            config_path,
            conversation_history: Mutex::new(Vec::new()),
            coze_conversation_id: Mutex::new(None),
            last_speech_text: Mutex::new(None),
            pending_pet_command: Mutex::new(None),
            last_position_save: Mutex::new(Instant::now()),
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let config = self.config.lock().map_err(|e| e.to_string())?;
        let json = serde_json::to_string_pretty(&*config).map_err(|e| e.to_string())?;
        fs::write(&self.config_path, json).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Called from the window `Moved` event. At 60 fps this would otherwise write
    /// config.json on every frame, so only persist at most once per 800 ms.
    /// The final position is persisted explicitly by `persist_window_position`.
    pub fn save_position_throttled(&self) {
        let should_save = {
            let mut last = match self.last_position_save.lock() {
                Ok(v) => v,
                Err(_) => return,
            };
            if last.elapsed() >= Duration::from_millis(800) {
                *last = Instant::now();
                true
            } else {
                false
            }
        };
        if should_save {
            let _ = self.save();
        }
    }
}

fn get_config_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.pet-desktop")
}
