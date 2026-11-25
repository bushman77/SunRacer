#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod network;
mod native_loopback;
mod sbs_relay_probe;

use std::sync::atomic::{AtomicBool, Ordering};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_updater::UpdaterExt;

// Only the bundled launcher can request a check. Consent, signature
// verification and installation stay native; remote pages get no capability.
static UPDATE_ACTIVE: AtomicBool = AtomicBool::new(false);

struct UpdateGuard;

impl Drop for UpdateGuard {
    fn drop(&mut self) {
        UPDATE_ACTIVE.store(false, Ordering::Release);
    }
}

#[tauri::command]
async fn check_client_update(app: tauri::AppHandle, window: tauri::WebviewWindow) -> Result<String, String> {
    network::require_local(&window)?;
    check_for_updates(app).await
}
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            check_client_update,
            network::get_network_settings,
            network::save_network_settings,
            network::restart_client,
            native_loopback::native_loopback_post,
            sbs_relay_probe::start_sbs_relay_probe,
            sbs_relay_probe::sbs_relay_probe_status,
            sbs_relay_probe::stop_sbs_relay_probe,
            sbs_relay_probe::publish_sbs_relay_world,
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Create the installed production webview using its bundled window
            // configuration, with an optional native SOCKS5 tunnel override.
            // Never expose this control to the remote page or enable it by default.
            let window_config = &app.config().app.windows[0];
            let mut window = tauri::WebviewWindowBuilder::from_config(app.handle(), window_config)?;

            if let Some(proxy_url) = network::startup_proxy(app.handle()) {
                window = window.proxy_url(proxy_url.parse()?);
                eprintln!("SunRacer: native webview proxy enabled ({proxy_url})");
            }

            window.build()?;

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(error) = check_for_updates(handle).await {
                    // Never block game access when GitHub Releases is unreachable
                    // (for example, on a restricted institutional network).
                    eprintln!("SunRacer update check unavailable: {error}");
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to launch the SunRacer desktop client");
}

async fn check_for_updates(app: tauri::AppHandle) -> Result<String, String> {
    // Keep one check, confirmation or installation in flight across both entry points.
    if UPDATE_ACTIVE.compare_exchange(false, true, Ordering::Acquire, Ordering::Relaxed).is_err() {
        return Ok("An update check or installation is already in progress.".into());
    }
    let _guard = UpdateGuard;
    // The Linux updater is intended for self-contained AppImages, not .deb
    // installations managed by apt/dpkg.
    #[cfg(target_os = "linux")]
    if std::env::var_os("APPIMAGE").is_none() {
        return Ok("For Debian packages, download and install the latest .deb from GitHub Releases. In-app updates are available for AppImage and Windows.".into());
    }

    let updater = app
        .updater_builder()
        .timeout(std::time::Duration::from_secs(15))
        .build().map_err(|error| error.to_string())?;

    let Some(update) = updater.check().await.map_err(|error| error.to_string())? else {
        return Ok("SunRacer is up to date.".into());
    };
    let version = update.version.clone();
    let (send, receive) = tokio::sync::oneshot::channel();
    app.dialog()
        .message(format!(
            "SunRacer {version} is available. Download and install the signed update now?"
        ))
        .title("SunRacer update available")
        .buttons(MessageDialogButtons::OkCancel)
        .show(move |accepted| { let _ = send.send(accepted); });

    let accepted = receive.await.unwrap_or(false);
    if !accepted {
        return Ok(format!("SunRacer {version} is available. Update postponed."));
    }

    match update.download_and_install(|_, _| {}, || {}).await {
        Ok(()) => {
            // Windows exits automatically when NSIS begins installing.
            #[cfg(not(target_os = "windows"))]
            app.restart();
            #[allow(unreachable_code)]
            Ok("Update installed. Restarting SunRacer.".into())
        }
        Err(error) => {
            eprintln!("SunRacer update installation failed: {error}");
            app.dialog()
                .message("The signed update could not be installed.")
                .kind(MessageDialogKind::Error)
                .title("SunRacer update failed")
                .show(|_| {});
            Err(error.to_string())
        }
    }
}
