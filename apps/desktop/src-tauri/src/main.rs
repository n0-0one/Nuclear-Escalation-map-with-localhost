#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use tokio::sync::Mutex;
use war_thunder_telemetry::{TelemetryClient, Snapshot};
use tauri::Manager;
use std::io::Write;
struct SmokeMode(bool);
#[tauri::command]
async fn telemetry_snapshot(client: tauri::State<'_, Mutex<TelemetryClient>>) -> Result<Snapshot,String> {
    Ok(client.lock().await.snapshot().await)
}
#[tauri::command]
fn export_json(app: tauri::AppHandle, kind: String, content: String) -> Result<String,String> {
    if !["battle", "diagnostics"].contains(&kind.as_str()) || content.len() > 2*1024*1024 { return Err("Invalid export".into()); }
    let directory=app.path().download_dir().map_err(|e|e.to_string())?;
    let path=directory.join(format!("nuclear-thunder-{}-{}.json",kind,war_thunder_telemetry::now_ms()));
    let mut file=std::fs::OpenOptions::new().create_new(true).write(true).open(&path).map_err(|e|e.to_string())?;
    file.write_all(content.as_bytes()).map_err(|e|e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}
#[tauri::command]
fn native_smoke_complete(app: tauri::AppHandle, smoke: tauri::State<SmokeMode>, report: serde_json::Value) -> Result<(),String> {
    if !smoke.0 { return Err("Smoke reporting is disabled in normal operation".into()); }
    let directory=std::env::current_dir().map_err(|e|e.to_string())?.join("docs/verification");
    std::fs::create_dir_all(&directory).map_err(|e|e.to_string())?;
    std::fs::write(directory.join("native-smoke.json"),serde_json::to_vec_pretty(&report).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
    app.exit(if report["success"]==true {0}else{1});Ok(())
}
fn main() {
    let smoke=std::env::args().any(|a|a=="--smoke-test");
    tauri::Builder::default()
        .manage(SmokeMode(smoke))
        .manage(Mutex::new(TelemetryClient::new().expect("HTTP client initialization failed")))
        .setup(move |app| { if smoke { if let Some(window)=app.get_webview_window("main"){window.hide()?;} let handle=app.handle().clone();tauri::async_runtime::spawn(async move{tokio::time::sleep(std::time::Duration::from_secs(45)).await;handle.exit(2);}); } Ok(()) })
        .on_page_load(move |webview,payload| {
            if smoke && matches!(payload.event(),tauri::webview::PageLoadEvent::Finished) {
                let _=webview.eval(include_str!("smoke.js"));
            }
        })
        .invoke_handler(tauri::generate_handler![telemetry_snapshot, export_json,native_smoke_complete])
        .run(tauri::generate_context!()).expect("Unable to start Nuclear Thunder Live");
}
