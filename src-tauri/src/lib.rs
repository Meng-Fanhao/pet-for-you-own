// Copyright (c) 2026 孟凡皓 (cn.bj). All rights reserved.
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, State};

mod autostart;
mod chat;
mod chat_coze;
mod state;
mod tray;
mod window;

use state::{AppConfig, AppState};

#[derive(Debug, Serialize, Deserialize)]
pub struct ConfigPayload {
    pub pet_image_path: Option<String>,
    pub window_x: Option<f64>,
    pub window_y: Option<f64>,
    pub autostart_enabled: Option<bool>,
    pub sleep_mode: Option<bool>,
    pub language: Option<String>,
    pub ai_provider: Option<String>,
    pub deepseek_api_key: Option<String>,
    pub coze_pat: Option<String>,
    pub coze_bot_id: Option<String>,
    pub pet_persona: Option<String>,
    pub conversation_memory: Option<usize>,
    pub pet_size: Option<u32>,
    pub random_actions_enabled: Option<bool>,
    pub wander_enabled: Option<bool>,
    pub throw_power: Option<f64>,
    pub bounce: Option<f64>,
}

#[tauri::command]
fn save_config(
    app: tauri::AppHandle,
    state: State<AppState>,
    payload: ConfigPayload,
) -> Result<(), String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;

    if let Some(path) = payload.pet_image_path {
        config.pet_image_path = if path.is_empty() { None } else { Some(path) };
    }
    if let Some(x) = payload.window_x {
        config.window_x = x;
    }
    if let Some(y) = payload.window_y {
        config.window_y = y;
    }
    if let Some(enabled) = payload.autostart_enabled {
        config.autostart_enabled = enabled;
        if enabled {
            autostart::enable_autostart()?;
        } else {
            autostart::disable_autostart()?;
        }
    }
    if let Some(sleep) = payload.sleep_mode {
        config.sleep_mode = sleep;
    }
    if let Some(lang) = payload.language {
        config.language = lang;
    }
    if let Some(prov) = payload.ai_provider {
        config.ai_provider = prov;
    }
    if let Some(key) = payload.deepseek_api_key {
        config.deepseek_api_key = key;
    }
    if let Some(pat) = payload.coze_pat {
        config.coze_pat = pat;
    }
    if let Some(bot) = payload.coze_bot_id {
        config.coze_bot_id = bot;
    }
    if let Some(persona) = payload.pet_persona {
        config.pet_persona = persona;
    }
    if let Some(mem) = payload.conversation_memory {
        config.conversation_memory = mem;
    }

    let mut new_size = None;
    if let Some(size) = payload.pet_size {
        let size = size.clamp(96, 768);
        if config.pet_size != size {
            config.pet_size = size;
            new_size = Some(size);
        }
    }
    if let Some(enabled) = payload.random_actions_enabled {
        config.random_actions_enabled = enabled;
    }
    if let Some(enabled) = payload.wander_enabled {
        config.wander_enabled = enabled;
    }
    if let Some(power) = payload.throw_power {
        if power.is_finite() && power > 0.0 {
            config.throw_power = power.clamp(0.2, 4.0);
        }
    }
    if let Some(bounce) = payload.bounce {
        if bounce.is_finite() {
            config.bounce = bounce.clamp(0.0, 1.0);
        }
    }

    drop(config);
    state.save()?;
    if let Some(size) = new_size {
        window::apply_pet_size(&app, size);
    }
    Ok(())
}

#[tauri::command]
fn load_config(state: State<AppState>) -> Result<AppConfig, String> {
    state.config.lock().map(|c| c.clone()).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_app_data_dir() -> Result<String, String> {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.pet-desktop")
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Cannot determine data directory".to_string())
}

#[tauri::command]
fn toggle_visibility(app: tauri::AppHandle) -> Result<bool, String> {
    window::toggle_main_window(&app);
    let visible = app
        .get_webview_window("main")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);
    Ok(visible)
}

#[tauri::command]
fn set_autostart(state: State<AppState>, enabled: bool) -> Result<(), String> {
    let result = if enabled {
        autostart::enable_autostart()
    } else {
        autostart::disable_autostart()
    };

    if result.is_ok() {
        let mut config = state.config.lock().map_err(|e| e.to_string())?;
        config.autostart_enabled = enabled;
    }
    result
}

#[tauri::command]
fn get_autostart_status() -> bool {
    autostart::is_autostart_enabled()
}

#[tauri::command]
fn start_window_drag(window: tauri::Window) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
fn broadcast_config_updated(app: tauri::AppHandle) -> Result<(), String> {
    app.emit("config-updated", ()).map_err(|e| e.to_string())
}

#[tauri::command]
async fn chat_with_pet(state: State<'_, AppState>, message: String) -> Result<String, String> {
    let (provider, ds_key, coze_pat, coze_bot_id, persona, memory_limit) = {
        let config = state.config.lock().map_err(|e| e.to_string())?;
        (
            config.ai_provider.clone(),
            config.deepseek_api_key.clone(),
            config.coze_pat.clone(),
            config.coze_bot_id.clone(),
            config.pet_persona.clone(),
            config.conversation_memory,
        )
    };

    let response = if provider == "coze" {
        if coze_pat.is_empty() || coze_bot_id.is_empty() {
            return Err("Coze PAT or Bot ID not configured. Please set them in Settings.".into());
        }
        let mut cid = {
            state.coze_conversation_id.lock().map_err(|e| e.to_string())?.clone()
        };
        let resp = chat_coze::send_coze_message(
            &coze_pat, &coze_bot_id,
            "https://api.coze.cn/v3",
            "desktop_pet_user",
            &mut cid, &message,
        ).await?;
        // Store updated conversation_id
        {
            let mut c = state.coze_conversation_id.lock().map_err(|e| e.to_string())?;
            *c = cid;
        }
        resp
    } else {
        if ds_key.is_empty() {
            return Err("DeepSeek API key not configured. Please set it in Settings.".into());
        }
        let history = {
            let hist = state.conversation_history.lock().map_err(|e| e.to_string())?;
            let total = hist.len();
            let skip = if total > memory_limit { total - memory_limit } else { 0 };
            hist.iter().skip(skip).cloned().collect::<Vec<_>>()
        };
        let resp = chat::send_chat_message(&ds_key, &persona, &history, &message).await?;
        // Save to conversation history
        {
            let mut hist = state.conversation_history.lock().map_err(|e| e.to_string())?;
            hist.push((message.clone(), resp.clone()));
            while hist.len() > memory_limit * 2 {
                hist.remove(0);
            }
        }
        resp
    };

    // Store for speech bubble
    {
        let mut speech = state.last_speech_text.lock().map_err(|e| e.to_string())?;
        *speech = Some(response.clone());
    }

    Ok(response)
}

#[tauri::command]
fn poll_speech_bubble(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let mut speech = state.last_speech_text.lock().map_err(|e| e.to_string())?;
    Ok(speech.take())
}

#[tauri::command]
fn clear_conversation(state: State<'_, AppState>) -> Result<(), String> {
    let mut hist = state.conversation_history.lock().map_err(|e| e.to_string())?;
    hist.clear();
    let mut cid = state.coze_conversation_id.lock().map_err(|e| e.to_string())?;
    *cid = None;
    Ok(())
}

#[tauri::command]
fn get_conversation_history(state: State<'_, AppState>) -> Result<Vec<(String, String)>, String> {
    let hist = state.conversation_history.lock().map_err(|e| e.to_string())?;
    Ok(hist.clone())
}

#[tauri::command]
fn load_pet_image_url(state: State<AppState>) -> Result<String, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let path = match &config.pet_image_path {
        Some(p) => p.clone(),
        None => return Ok(String::new()),
    };
    drop(config);

    let bytes = std::fs::read(&path).map_err(|e| format!("Failed to read image: {}", e))?;

    let ext = if path.ends_with(".png") { "png" }
        else if path.ends_with(".gif") { "gif" }
        else if path.ends_with(".webp") { "webp" }
        else { "jpeg" };

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:image/{};base64,{}", ext, b64))
}

/// Cheap change token for the pet image: mtime + length. The pet window polls
/// this once per second and only re-reads the (potentially large) image when
/// the token changes, instead of base64-encoding it every second.
fn image_version(path: &Option<String>) -> String {
    match path {
        Some(p) => match std::fs::metadata(p) {
            Ok(meta) => {
                let len = meta.len();
                let mtime = meta
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_nanos())
                    .unwrap_or(0);
                format!("{}:{}", mtime, len)
            }
            Err(_) => "missing".to_string(),
        },
        None => "none".to_string(),
    }
}

#[derive(Debug, Serialize)]
pub struct PetRuntimeState {
    pub image_version: String,
    pub pet_size: u32,
    pub random_actions_enabled: bool,
    pub wander_enabled: bool,
    pub throw_power: f64,
    pub bounce: f64,
    pub language: String,
}

#[tauri::command]
fn get_pet_runtime_state(state: State<AppState>) -> Result<PetRuntimeState, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(PetRuntimeState {
        image_version: image_version(&config.pet_image_path),
        pet_size: config.pet_size,
        random_actions_enabled: config.random_actions_enabled,
        wander_enabled: config.wander_enabled,
        throw_power: config.throw_power,
        bounce: config.bounce,
        language: config.language.clone(),
    })
}

#[tauri::command]
fn poll_pet_command(state: State<AppState>) -> Result<Option<String>, String> {
    let mut command = state.pending_pet_command.lock().map_err(|e| e.to_string())?;
    Ok(command.take())
}

#[tauri::command]
fn save_pet_image(state: State<AppState>, image_bytes: Vec<u8>, ext: String) -> Result<String, String> {
    let config_dir = state.config_path.parent().unwrap().to_path_buf();
    let image_path = config_dir.join(format!("pet_image.{}", ext));

    std::fs::write(&image_path, &image_bytes)
        .map_err(|e| format!("Failed to write image: {}", e))?;

    let path_str = image_path.to_str().ok_or("Invalid image path")?.to_string();

    // Update config with the file path
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    config.pet_image_path = Some(path_str.clone());
    drop(config);
    state.save()?;

    Ok(path_str)
}

pub fn open_settings_window(app: &tauri::AppHandle) {
    use tauri::WebviewUrl;
    use tauri::WebviewWindowBuilder;

    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    let _ = WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("settings.html".into()))
        .title("Desktop Pet - Settings")
        .inner_size(420.0, 680.0)
        .resizable(false)
        .build();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .on_menu_event(|app, event| {
            if let Some(command) = event.id().as_ref().strip_prefix("pet.") {
                match command {
                    "cmd.settings" => crate::open_settings_window(app),
                    "cmd.hide" => window::hide_main_window(app),
                    "cmd.quit" => app.exit(0),
                    other => {
                        if let Some(state) = app.try_state::<AppState>() {
                            if let Ok(mut pending) = state.pending_pet_command.lock() {
                                *pending = Some(other.to_string());
                            }
                        }
                    }
                }
            }
        })
        .setup(|app| {
            let handle = app.handle().clone();
            let start_hidden = std::env::args().any(|arg| arg == "--hidden");
            let saved_config = handle.state::<AppState>().config.lock().unwrap().clone();

            if let Some(w) = handle.get_webview_window("main") {
                // Restore the saved pet size (the window itself stays square).
                let _ = w.set_size(tauri::LogicalSize::new(
                    saved_config.pet_size as f64,
                    saved_config.pet_size as f64,
                ));

                // Restore saved position, or place the pet near the bottom-right
                // corner of the work area on first launch.
                if saved_config.window_x != 0.0 || saved_config.window_y != 0.0 {
                    let _ = w.set_position(tauri::PhysicalPosition::new(
                        saved_config.window_x,
                        saved_config.window_y,
                    ));
                } else if let Ok(Some(monitor)) = w.current_monitor() {
                    let scale = w.scale_factor().unwrap_or(1.0);
                    let area = monitor.work_area();
                    let physical = (saved_config.pet_size as f64 * scale).round() as i32;
                    let margin = (24.0 * scale).round() as i32;
                    let x = area.position.x + area.size.width as i32 - physical - margin;
                    let y = area.position.y + area.size.height as i32 - physical - margin;
                    let _ = w.set_position(tauri::PhysicalPosition::new(x, y));
                }

                if start_hidden {
                    let _ = w.hide();
                }

                // Keep the in-memory position up to date while dragging/animating.
                // Writes are throttled; the JS layer persists the final position.
                let app_handle = handle.clone();
                w.on_window_event(move |event| {
                    if let tauri::WindowEvent::Moved(position) = event {
                        let state = app_handle.state::<AppState>();
                        if let Ok(mut config) = state.config.lock() {
                            config.window_x = position.x as f64;
                            config.window_y = position.y as f64;
                        }
                        state.save_position_throttled();
                    }
                });
            }

            tray::setup_tray(&handle)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_config,
            load_config,
            get_app_data_dir,
            toggle_visibility,
            set_autostart,
            get_autostart_status,
            start_window_drag,
            save_pet_image,
            broadcast_config_updated,
            load_pet_image_url,
            get_pet_runtime_state,
            poll_pet_command,
            chat_with_pet,
            poll_speech_bubble,
            clear_conversation,
            get_conversation_history,
            window::get_window_geometry,
            window::get_screen_geometry,
            window::set_window_position,
            window::persist_window_position,
            window::show_pet_menu,
        ])
        .run(tauri::generate_context!())
        .expect("error while running desktop-pet");
}
