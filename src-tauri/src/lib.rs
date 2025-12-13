mod ai;
use ai::Message;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn ai_chat(app: tauri::AppHandle, api_key: String, messages: Vec<Message>, event_id: String) -> Result<(), String> {
    ai::stream_chat(app, api_key, messages, event_id).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, ai_chat])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
