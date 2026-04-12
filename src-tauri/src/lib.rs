use std::process::{Command, Child};
use std::sync::Mutex;
use tauri::{
    Manager,
    tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent},
    menu::{MenuBuilder, MenuItemBuilder},
};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

struct DaemonState(Mutex<Option<Child>>);

fn start_daemon() -> Option<Child> {
    let repo_root = std::env::current_dir()
        .unwrap_or_default()
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_default();

    let jarvisd_dir = repo_root.join("jarvisd");
    if !jarvisd_dir.exists() {
        log::warn!("jarvisd directory not found at {:?}", jarvisd_dir);
        return None;
    }

    match Command::new("npx")
        .args(["tsx", "src/index.ts"])
        .current_dir(&jarvisd_dir)
        .env("JARVIS_PORT", "8787")
        .spawn()
    {
        Ok(child) => {
            log::info!("jarvisd started (pid: {})", child.id());
            Some(child)
        }
        Err(e) => {
            log::error!("Failed to start jarvisd: {}", e);
            None
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::default().build())
        .setup(|app| {
            // Start the daemon
            let daemon = start_daemon();
            app.manage(DaemonState(Mutex::new(daemon)));

            // Logging
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // System tray
            let show = MenuItemBuilder::with_id("show", "Show JARVIS").build(app)?;
            let hide = MenuItemBuilder::with_id("hide", "Hide").build(app)?;
            let lock = MenuItemBuilder::with_id("lock", "Lock Vault").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&show)
                .item(&hide)
                .separator()
                .item(&lock)
                .separator()
                .item(&quit)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .tooltip("JARVIS OS")
                .menu(&menu)
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "hide" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.hide();
                            }
                        }
                        "lock" => {
                            // Fire-and-forget POST to lock vault
                            std::thread::spawn(|| {
                                let _ = std::process::Command::new("curl")
                                    .args(["-s", "-X", "POST", "http://127.0.0.1:8787/vault/lock"])
                                    .output();
                            });
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // Global shortcut: Cmd+Shift+J
            let app_handle = app.handle().clone();
            app.global_shortcut().on_shortcut("CmdOrCtrl+Shift+J", move |_, _, event| {
                if let tauri_plugin_global_shortcut::ShortcutState::Pressed = event.state {
                    if let Some(w) = app_handle.get_webview_window("main") {
                        if w.is_visible().unwrap_or(false) {
                            let _ = w.hide();
                        } else {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                }
            })?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Hide instead of close
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running JARVIS OS");
}
