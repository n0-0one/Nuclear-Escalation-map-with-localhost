fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
            "telemetry_snapshot", "export_json", "native_smoke_complete",
            "open_overlay", "close_overlay", "configure_overlay",
            "datamine_bootstrap", "datamine_check",
        ])),
    ).expect("Unable to generate native application permissions");
}
