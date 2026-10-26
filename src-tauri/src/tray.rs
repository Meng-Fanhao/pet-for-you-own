// Copyright (c) 2026 孟凡皓 (cn.bj). All rights reserved.
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle,
};

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_hide_item = MenuItemBuilder::with_id("show_hide", "Show/Hide Pet").build(app)?;
    let settings_item = MenuItemBuilder::with_id("settings", "Settings...").build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show_hide_item)
        .item(&settings_item)
        .separator()
        .item(&quit_item)
        .build()?;

    let icon_bytes = include_bytes!("../icons/icon.png");
    let decoded = image::load_from_memory(icon_bytes)
        .map_err(|e| format!("Failed to decode tray icon: {}", e))?;
    let rgba = decoded.to_rgba8();
    let (w, h) = (rgba.width(), rgba.height());
    let image = tauri::image::Image::new_owned(rgba.into_vec(), w, h);

    let _tray = TrayIconBuilder::new()
        .icon(image)
        .icon_as_template(true)
        .menu(&menu)
        .tooltip("Desktop Pet")
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "show_hide" => {
                crate::window::toggle_main_window(app);
            }
            "settings" => {
                crate::open_settings_window(app);
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                crate::window::toggle_main_window(app);
            }
        })
        .build(app)?;

    Ok(())
}
