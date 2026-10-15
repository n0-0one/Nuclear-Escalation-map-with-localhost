//! Fixed, read-only War Thunder loopback API. No URL supplied by the frontend.
use serde::Serialize;
use serde_json::Value;
use std::{collections::BTreeMap, time::{Duration, SystemTime, UNIX_EPOCH}};

pub const MAX_BODY: usize = 2 * 1024 * 1024;
pub fn now_ms() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64 }

#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub at: u64,
    pub map_info: Option<Value>,
    pub objects: Option<Value>,
    pub state: Option<Value>,
    pub indicators: Option<Value>,
    pub mission: Option<Value>,
    pub hud: Option<Value>,
    pub errors: BTreeMap<String, String>,
}

pub struct TelemetryClient {
    client: reqwest::Client,
    cached: Snapshot,
    last_metadata: u64,
    last_state: u64,
    last_indicators: u64,
    last_mission: u64,
    last_hud: u64,
}

impl TelemetryClient {
    pub fn new() -> Result<Self, reqwest::Error> {
        Ok(Self { client: reqwest::Client::builder().no_proxy().redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_millis(1000)).connect_timeout(Duration::from_millis(450)).build()?,
            cached: Snapshot::default(), last_metadata: 0, last_state: 0, last_indicators: 0, last_mission: 0, last_hud: 0 })
    }
    async fn get(&self, path: &str) -> Result<Value, String> {
        let mut response = self.client.get(format!("http://127.0.0.1:8111/{path}"))
            .send().await.map_err(|e| if e.is_timeout() { "request timeout" } else { "game unavailable" }.to_string())?;
        if !response.status().is_success() { return Err(format!("HTTP {}", response.status().as_u16())); }
        if response.content_length().unwrap_or(0) > MAX_BODY as u64 { return Err("response too large".into()); }
        let mut body = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|_| "body read failed")? {
            if body.len() + chunk.len() > MAX_BODY { return Err("response too large".into()); }
            body.extend_from_slice(&chunk);
        }
        serde_json::from_slice(&body).map_err(|_| "invalid JSON".into())
    }
    pub async fn snapshot(&mut self) -> Snapshot {
        let now = now_ms();
        // Multiple frontend callers share this cache under a mutex, avoiding duplicate polling.
        if now.saturating_sub(self.cached.at) < 250 { return self.cached.clone(); }
        // Independent fixed endpoints run concurrently; an unavailable endpoint
        // cannot multiply the request timeout for an entire refresh cycle.
        let (objects, metadata, state, indicators, mission, hud) = tokio::join!(
            self.get("map_obj.json"),
            async { if now.saturating_sub(self.last_metadata)>=2000 {Some(self.get("map_info.json").await)} else {None} },
            async { if now.saturating_sub(self.last_state)>=1000 {Some(self.get("state").await)} else {None} },
            async { if now.saturating_sub(self.last_indicators)>=3000 {Some(self.get("indicators").await)} else {None} },
            async { if now.saturating_sub(self.last_mission)>=3000 {Some(self.get("mission.json").await)} else {None} },
            async { if now.saturating_sub(self.last_hud)>=1500 {Some(self.get("hudmsg?lastEvt=0&lastDmg=0").await)} else {None} }
        );
        save_result(&mut self.cached.objects, &mut self.cached.errors, "objects", objects);
        if let Some(result) = metadata {
            save_result(&mut self.cached.map_info, &mut self.cached.errors, "mapInfo", result);
            self.last_metadata = now;
        }
        if let Some(result) = state {
            save_result(&mut self.cached.state, &mut self.cached.errors, "state", result);
            self.last_state = now;
        }
        if let Some(result) = indicators {
            save_result(&mut self.cached.indicators, &mut self.cached.errors, "indicators", result);
            self.last_indicators = now;
        }
        if let Some(result) = mission {
            save_result(&mut self.cached.mission, &mut self.cached.errors, "mission", result);
            self.last_mission = now;
        }
        if let Some(result) = hud {
            save_result(&mut self.cached.hud, &mut self.cached.errors, "hud", result);
            self.last_hud = now;
        }
        self.cached.at = now_ms();
        self.cached.clone()
    }
}
fn save_result(slot: &mut Option<Value>, errors: &mut BTreeMap<String,String>, name: &str, result: Result<Value,String>) {
    match result {
        Ok(value) => { *slot = Some(value); errors.remove(name); },
        Err(error) => { *slot = None; errors.insert(name.into(), error); }
    }
}

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn stale_data_is_removed_on_failure() {
        let mut value = Some(serde_json::json!({"valid":true})); let mut errors = BTreeMap::new();
        save_result(&mut value, &mut errors, "state", Err("timeout".into()));
        assert!(value.is_none()); assert_eq!(errors["state"], "timeout");
        save_result(&mut value, &mut errors, "state", Ok(serde_json::json!({"valid":false})));
        assert!(errors.is_empty()); assert_eq!(value.unwrap()["valid"], false);
    }
    #[test] fn wire_format_matches_frontend() {
        let v = serde_json::to_value(Snapshot::default()).unwrap();
        assert!(v.get("mapInfo").is_some()); assert!(v["objects"].is_null());
    }
}
