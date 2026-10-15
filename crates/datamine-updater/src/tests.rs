use super::*;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};
static NEXT: AtomicU64 = AtomicU64::new(0);
struct Directory(PathBuf);
impl Directory {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!(
            "ntl-update-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&path).unwrap();
        Self(path)
    }
}
impl Drop for Directory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
fn fixture() -> Value {
    let mut files = serde_json::Map::new();
    for suffix in ["", "_mirror", "_city", "_city_mirror"] {
        files.insert(format!("map_data{suffix}.json"),json!([{"name":"sam","team":1,"world_pos":[0,0,0],"units_by_era":{"rank-0-26":[{"name":"launcher","world_pos":[0,0,0],"lifecycle":{"kind":"none"}}]},"buildings_by_era":{"rank-0-26":[]}}]));
        files.insert(
            format!("mission_logic{suffix}.json"),
            json!({"sites":[{"name":"sam","world_pos":[0,0,0]}]}),
        );
    }
    files.insert("presets.json".into(),json!({"presets":[{"id":"rank-0-26"}],"variants":[{"id":"standard"},{"id":"mirror"},{"id":"city"},{"id":"city_mirror"}]}));
    files.insert(
        "unit_specs.json".into(),
        json!({"launcher":{"model":"test"}}),
    );
    files.insert(
        "unit_display_names.json".into(),
        json!({"launcher":"Test launcher"}),
    );
    files.insert("datamine-lock.json".into(),json!({"repository":"gszabi99/War-Thunder-Datamine","accepted_commit":"a".repeat(40),"sources":["mission"]}));
    json!({"formatVersion":1,"datamineCommit":"a".repeat(40),"files":files})
}
fn pack(value: &Value, time: u64) -> (Manifest, Vec<u8>) {
    let bytes = serde_json::to_vec(value).unwrap();
    let sha256 = format!("{:x}", Sha256::digest(&bytes));
    (
        Manifest {
            format_version: 1,
            datamine_commit: value["datamineCommit"].as_str().unwrap().into(),
            pack: format!("packs/{sha256}.json"),
            sha256,
            bytes: bytes.len(),
            published_at: time,
        },
        bytes,
    )
}
#[test]
fn rejects_tampering_paths_and_future_formats() {
    let (m, b) = pack(&fixture(), 1);
    assert!(validate_pack(&m, &b).is_ok());
    let mut corrupt = b.clone();
    corrupt[0] = b'x';
    assert!(validate_pack(&m, &corrupt)
        .unwrap_err()
        .contains("checksum"));
    let mut wrong = m.clone();
    wrong.pack = "../code.js".into();
    assert!(validate_pack(&wrong, &b).is_err());
    wrong = m.clone();
    wrong.format_version = 2;
    assert!(validate_pack(&wrong, &b).is_err());
}
#[test]
fn rejects_display_code_missing_variants_and_scenarios() {
    for change in 0..4 {
        let mut value = fixture();
        match change {
            0 => {
                value["files"]["unit_display_names.json"]["launcher"] =
                    "<img onerror=alert(1)>".into();
            }
            1 => {
                value["files"]["presets.json"]["variants"][0]["id"] = "unknown".into();
            }
            2 => {
                value["files"]["map_data_city.json"][0]["units_by_era"] = json!({});
            }
            _ => {
                value["files"]["legacy.js"] = "executable".into();
            }
        }
        let (m, b) = pack(&value, 1);
        assert!(validate_pack(&m, &b).is_err());
    }
}
#[test]
fn cache_replaces_atomically_and_keeps_verified_fallback() {
    let dir = Directory::new();
    let updater = Updater::new(dir.0.clone(), "bundled".into()).unwrap();
    assert_eq!(updater.snapshot().source, "bundled");
    let (m, b) = pack(&fixture(), 1);
    updater.install(&m, &b).unwrap();
    let mut next = fixture();
    next["files"]["unit_display_names.json"]["launcher"] = "New launcher".into();
    let (n, c) = pack(&next, 2);
    updater.install(&n, &c).unwrap();
    assert_eq!(
        updater.snapshot().data.unwrap()["unit_display_names.json"]["launcher"],
        "New launcher"
    );
    assert!(updater.install(&m, &b).is_err());
    fs::write(dir.0.join(format!("{}.json", n.sha256)), "corrupt").unwrap();
    let recovered = updater.snapshot();
    assert!(recovered.warning.is_some());
    assert_eq!(
        recovered.data.unwrap()["unit_display_names.json"]["launcher"],
        "Test launcher"
    );
    fs::write(dir.0.join(format!("{}.json", m.sha256)), "corrupt").unwrap();
    assert_eq!(updater.snapshot().source, "bundled");
}
#[test]
fn invalid_download_never_changes_the_working_cache() {
    let dir = Directory::new();
    let updater = Updater::new(dir.0.clone(), "bundled".into()).unwrap();
    let (m, b) = pack(&fixture(), 1);
    updater.install(&m, &b).unwrap();
    assert!(updater.install(&m, b"broken").is_err());
    assert_eq!(updater.snapshot().revision, m.datamine_commit);
    let manifest = fs::read(dir.0.join("active.json")).unwrap();
    assert_eq!(
        serde_json::from_slice::<Manifest>(&manifest)
            .unwrap()
            .sha256,
        m.sha256
    );
}
#[test]
fn checked_in_data_passes_the_native_validator() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../apps/web/public");
    let mut files = serde_json::Map::new();
    for name in FILES {
        files.insert(
            name.into(),
            serde_json::from_slice::<Value>(&fs::read(root.join(name)).unwrap()).unwrap(),
        );
    }
    let value = json!({"formatVersion":1,"datamineCommit":files["datamine-lock.json"]["accepted_commit"],"files":files});
    let (m, b) = pack(&value, 1);
    validate_pack(&m, &b).unwrap();
}
#[tokio::test]
#[ignore = "Explicit production-feed integration check; requires network"]
async fn production_feed_download_restart_and_offline_cache() {
    let dir = Directory::new();
    let mut updater = Updater::new(dir.0.clone(), "bundled".into()).unwrap();
    let result = updater.check().await.unwrap();
    assert!(result.updated);
    let restarted = Updater::new(dir.0.clone(), "bundled".into()).unwrap();
    let snapshot = restarted.snapshot();
    assert_eq!(snapshot.source, "downloaded");
    assert_eq!(snapshot.revision, result.revision);
    assert_eq!(snapshot.data.unwrap().as_object().unwrap().len(), 12);
    // No network is needed to open the verified cache after restart.
    assert!(!updater.check().await.unwrap().message.is_empty());
    println!("Verified production feed revision: {}", result.revision);
}
