// Copyright (c) 2026 孟凡皓 (cn.bj). All rights reserved.
use serde::Serialize;
use tauri::menu::{ContextMenu, MenuBuilder, SubmenuBuilder};
use tauri::{Manager, PhysicalPosition, State};

use crate::state::AppState;

#[allow(dead_code)]
pub fn create_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn hide_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

pub fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

/// Resize the pet window and keep it fully inside the current monitor's work area.
pub fn apply_pet_size(app: &tauri::AppHandle, size: u32) {
    if let Some(window) = app.get_webview_window("main") {
        let size = size.clamp(96, 768);
        let _ = window.set_size(tauri::LogicalSize::new(size as f64, size as f64));

        if let Ok(Some(monitor)) = window.current_monitor() {
            let scale = window.scale_factor().unwrap_or(1.0);
            let pos = window
                .outer_position()
                .unwrap_or_else(|_| PhysicalPosition::new(0, 0));
            let area = monitor.work_area();
            let physical = ((size as f64) * scale).round() as i32;
            let max_x = area.position.x + area.size.width as i32 - physical;
            let max_y = area.position.y + area.size.height as i32 - physical;
            let nx = pos.x.min(max_x).max(area.position.x);
            let ny = pos.y.min(max_y).max(area.position.y);
            let _ = window.set_position(PhysicalPosition::new(nx, ny));
        }
    }
}

// ---------------------------------------------------------------------------
// Geometry commands used by the JS physics / wandering layer.
// All values returned to JS are logical (CSS) pixels. `set_window_position`
// accepts logical pixels and converts them back to physical ones.
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct WindowGeometry {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub scale_factor: f64,
}

#[derive(Debug, Serialize)]
pub struct ScreenGeometry {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub work_x: f64,
    pub work_y: f64,
    pub work_width: f64,
    pub work_height: f64,
    pub scale_factor: f64,
}

#[tauri::command]
pub fn get_window_geometry(window: tauri::Window) -> Result<WindowGeometry, String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.inner_size().map_err(|e| e.to_string())?;
    Ok(WindowGeometry {
        x: pos.x as f64 / scale,
        y: pos.y as f64 / scale,
        width: size.width as f64 / scale,
        height: size.height as f64 / scale,
        scale_factor: scale,
    })
}

#[tauri::command]
pub fn get_screen_geometry(window: tauri::Window) -> Result<ScreenGeometry, String> {
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .or_else(|| window.primary_monitor().ok().flatten())
        .ok_or_else(|| "No monitor available".to_string())?;

    let scale = monitor.scale_factor();
    let pos = monitor.position();
    let size = monitor.size();
    let area = monitor.work_area();

    // Some platforms report an empty work area; fall back to the full monitor.
    let (wa_x, wa_y, wa_w, wa_h) = if area.size.width == 0 || area.size.height == 0 {
        (pos.x, pos.y, size.width, size.height)
    } else {
        (
            area.position.x,
            area.position.y,
            area.size.width,
            area.size.height,
        )
    };

    Ok(ScreenGeometry {
        x: pos.x as f64 / scale,
        y: pos.y as f64 / scale,
        width: size.width as f64 / scale,
        height: size.height as f64 / scale,
        work_x: wa_x as f64 / scale,
        work_y: wa_y as f64 / scale,
        work_width: wa_w as f64 / scale,
        work_height: wa_h as f64 / scale,
        scale_factor: scale,
    })
}

#[tauri::command]
pub fn set_window_position(window: tauri::Window, x: f64, y: f64) -> Result<(), String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let physical = PhysicalPosition::new(
        (x * scale).round() as i32,
        (y * scale).round() as i32,
    );
    window.set_position(physical).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn persist_window_position(window: tauri::Window, state: State<AppState>) -> Result<(), String> {
    // Read the real position instead of trusting the last `Moved` event:
    // the final set_position of a throw may still be in flight when JS asks
    // us to persist.
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    {
        let mut config = state.config.lock().map_err(|e| e.to_string())?;
        config.window_x = pos.x as f64;
        config.window_y = pos.y as f64;
    }
    state.save()
}

// ---------------------------------------------------------------------------
// Native right-click menu. Menu item ids are `pet.<command>`; the global
// `on_menu_event` handler either performs app-level actions directly or puts
// the command into `pending_pet_command` for the pet window to poll.
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn show_pet_menu(window: tauri::Window, state: State<'_, AppState>) -> Result<(), String> {
    let zh = state
        .config
        .lock()
        .map(|c| c.language == "zh")
        .unwrap_or(false);

    let actions = SubmenuBuilder::new(&window, if zh { "动作" } else { "Actions" })
        .text("pet.anim.idle", if zh { "待机" } else { "Idle" })
        .text("pet.anim.stretch", if zh { "伸懒腰" } else { "Stretch" })
        .text("pet.anim.hop", if zh { "蹦一下" } else { "Hop" })
        .text("pet.anim.spin", if zh { "转一圈" } else { "Spin" })
        .text("pet.anim.shake", if zh { "抖一抖" } else { "Shake" })
        .text("pet.anim.look", if zh { "东张西望" } else { "Look around" })
        .text("pet.anim.wave", if zh { "挥手" } else { "Wave" })
        .text("pet.anim.doze", if zh { "打瞌睡" } else { "Doze" })
        .separator()
        .text("pet.anim.turn", if zh { "左右转向" } else { "Turn around" })
        .text("pet.anim.walk", if zh { "走一段" } else { "Walk" })
        .build()
        .map_err(|e| e.to_string())?;

    let menu = MenuBuilder::new(&window)
        .item(&actions)
        .separator()
        .text("pet.cmd.feed", if zh { "喂食" } else { "Feed" })
        .text("pet.cmd.pet", if zh { "摸摸头" } else { "Pet" })
        .text("pet.cmd.home", if zh { "回到右下角" } else { "Back to corner" })
        .text("pet.cmd.sleep", if zh { "睡觉" } else { "Sleep" })
        .text("pet.cmd.wake", if zh { "叫醒" } else { "Wake up" })
        .separator()
        .text("pet.cmd.settings", if zh { "设置…" } else { "Settings…" })
        .text("pet.cmd.hide", if zh { "隐藏" } else { "Hide" })
        .text("pet.cmd.quit", if zh { "退出" } else { "Quit" })
        .build()
        .map_err(|e| e.to_string())?;

    // Let the menu appear above the always-on-top pet window.
    let _ = window.set_focus();

    let cursor = window
        .app_handle()
        .cursor_position()
        .map_err(|e| e.to_string())?;
    let outer = window.outer_position().map_err(|e| e.to_string())?;
    let relative = PhysicalPosition::new(cursor.x - outer.x as f64, cursor.y - outer.y as f64);

    menu.popup_at(window, relative).map_err(|e| e.to_string())
}
