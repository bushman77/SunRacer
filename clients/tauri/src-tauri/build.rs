fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "get_network_settings",
                "save_network_settings",
                "restart_client",
                "native_loopback_post",
                "start_sbs_relay_probe",
                "sbs_relay_probe_status",
                "stop_sbs_relay_probe",
                "publish_sbs_relay_world",
            ]),
        ),
    )
    .expect("Unable to generate local-network command permissions");
}
