use axum::{extract::{Request, State}, http::{HeaderMap, HeaderValue, StatusCode, Method}, middleware::{self, Next}, response::{IntoResponse, Response}, routing::get, Json, Router};
use std::{sync::Arc, collections::HashSet};
use tokio::sync::Mutex;
use war_thunder_telemetry::TelemetryClient;
use rand::Rng;

#[derive(Clone)] struct App { token: String, origins: HashSet<String>, client: Arc<Mutex<TelemetryClient>> }
fn authorized(headers: &HeaderMap, token: &str) -> bool {
    let expected = format!("Bearer {token}");
    let actual = headers.get("authorization").and_then(|v| v.to_str().ok()).unwrap_or("");
    // Fixed-length comparison avoids early mismatch on valid-length credentials.
    actual.len() == expected.len() && actual.bytes().zip(expected.bytes()).fold(0u8, |d,(a,b)| d | (a ^ b)) == 0
}
fn valid_origin(value: &str) -> bool {
    let Ok(uri) = value.parse::<axum::http::Uri>() else { return false; };
    matches!(uri.scheme_str(), Some("https") | Some("http")) && uri.host().is_some()
        && !value.contains('@') && uri.path_and_query().map(|p| p.as_str() == "/").unwrap_or(true)
        && !value.ends_with('/')
}
async fn guard(State(app): State<App>, req: Request, next: Next) -> Response {
    let host = req.headers().get("host").and_then(|v| v.to_str().ok()).unwrap_or("");
    if host != "127.0.0.1:8112" { return StatusCode::FORBIDDEN.into_response(); }
    let origin = req.headers().get("origin").and_then(|v| v.to_str().ok()).map(str::to_owned);
    if origin.as_ref().is_some_and(|v| !app.origins.contains(v)) { return StatusCode::FORBIDDEN.into_response(); }
    let mut response = if req.method() == Method::OPTIONS {
        if origin.is_none() || req.headers().get("access-control-request-method").and_then(|v|v.to_str().ok()) != Some("GET") {
            return StatusCode::FORBIDDEN.into_response();
        }
        StatusCode::NO_CONTENT.into_response()
    } else {
        if req.method() != Method::GET { return StatusCode::METHOD_NOT_ALLOWED.into_response(); }
        if !authorized(req.headers(), &app.token) { return StatusCode::UNAUTHORIZED.into_response(); }
        next.run(req).await
    };
    if let Some(origin) = origin {
        response.headers_mut().insert("access-control-allow-origin", HeaderValue::from_str(&origin).unwrap());
        response.headers_mut().insert("vary", HeaderValue::from_static("Origin"));
        response.headers_mut().insert("access-control-allow-methods", HeaderValue::from_static("GET"));
        response.headers_mut().insert("access-control-allow-headers", HeaderValue::from_static("Authorization"));
        response.headers_mut().insert("access-control-allow-private-network", HeaderValue::from_static("true"));
    }
    response.headers_mut().insert("cache-control", HeaderValue::from_static("no-store"));
    response
}
async fn snapshot(State(app): State<App>) -> impl IntoResponse { Json(app.client.lock().await.snapshot().await) }

#[tokio::main] async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut origins: HashSet<String> = ["http://127.0.0.1:5173", "http://127.0.0.1:4173"].into_iter().map(str::to_owned).collect();
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        if arg == "--help" { println!("Nuclear Thunder Live bridge\nUsage: ntl-bridge.exe [--origin https://YOUR-NAME.github.io]\nPaste the printed pairing code in the Live panel. Ctrl+C stops the bridge."); return Ok(()); }
        if arg != "--origin" { return Err("Only --origin is supported".into()); }
        let origin = args.next().ok_or("Missing origin")?;
        if !valid_origin(&origin) { return Err("Origin must be an exact http(s) origin without a path, credentials or trailing slash".into()); }
        origins.insert(origin);
    }
    let token: String = rand::rng().random::<[u8;32]>().iter().map(|b|format!("{b:02x}")).collect();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8112").await?;
    println!("Nuclear Thunder Live bridge — loopback only\nAllowed origins: {origins:?}\nPairing code: {token}\nCtrl+C to stop. Telemetry stays on this computer.");
    let app = App { token, origins, client: Arc::new(Mutex::new(TelemetryClient::new()?)) };
    let router = Router::new().route("/v1/snapshot", get(snapshot)).route("/health", get(||async {"Nuclear Thunder Live bridge"}))
        .layer(axum::extract::DefaultBodyLimit::max(1024)).layer(middleware::from_fn_with_state(app.clone(), guard)).with_state(app);
    axum::serve(listener, router).with_graceful_shutdown(async { let _ = tokio::signal::ctrl_c().await; }).await?;
    Ok(())
}

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn exact_origins_only() { assert!(valid_origin("https://example.github.io")); assert!(!valid_origin("https://example.github.io/repo")); assert!(!valid_origin("null")); assert!(!valid_origin("https://u@host")); }
    #[test] fn bearer_required() { let mut h=HeaderMap::new(); assert!(!authorized(&h,"secret")); h.insert("authorization", HeaderValue::from_static("Bearer secret")); assert!(authorized(&h,"secret")); assert!(!authorized(&h,"secrex")); }
}
