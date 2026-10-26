// Copyright (c) 2026 孟凡皓 (cn.bj). All rights reserved.
use std::fs;

pub fn enable_autostart() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let plist_content = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.pet-desktop.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
        <string>--hidden</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>"#,
            std::env::current_exe()
                .map_err(|e| e.to_string())?
                .to_string_lossy()
        );

        let launch_agents_dir = dirs::home_dir()
            .ok_or("Cannot find home directory")?
            .join("Library")
            .join("LaunchAgents");

        fs::create_dir_all(&launch_agents_dir).map_err(|e| e.to_string())?;
        let plist_path = launch_agents_dir.join("com.pet-desktop.app.plist");
        fs::write(&plist_path, plist_content).map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let exe_path = std::env::current_exe()
            .map_err(|e| e.to_string())?;

        Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "DesktopPet",
                "/t",
                "REG_SZ",
                "/d",
                &format!("{} --hidden", exe_path.to_string_lossy()),
                "/f",
            ])
            .output()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub fn disable_autostart() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let plist_path = dirs::home_dir()
            .ok_or("Cannot find home directory")?
            .join("Library")
            .join("LaunchAgents")
            .join("com.pet-desktop.app.plist");

        if plist_path.exists() {
            fs::remove_file(&plist_path).map_err(|e| e.to_string())?;
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("reg")
            .args([
                "delete",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "DesktopPet",
                "/f",
            ])
            .output()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub fn is_autostart_enabled() -> bool {
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir()
            .map(|h| {
                h.join("Library")
                    .join("LaunchAgents")
                    .join("com.pet-desktop.app.plist")
                    .exists()
            })
            .unwrap_or(false)
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("reg")
            .args([
                "query",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "DesktopPet",
            ])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    false
}
