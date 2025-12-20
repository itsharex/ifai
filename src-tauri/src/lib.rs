use tauri::{Emitter, Manager};
use ifainew_core;

mod file_walker;
mod terminal;
mod search;
mod git;
mod lsp;
mod prompt_manager;
mod agent_system;
mod conversation;
mod ai_utils;
mod commands;
mod performance;
use terminal::TerminalManager;
use lsp::LspManager;
use agent_system::Supervisor;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn ai_chat(
    app: tauri::AppHandle,
    state: tauri::State<'_, ifainew_core::RagState>,
    provider_config: ifainew_core::ai::AIProviderConfig,
    mut messages: Vec<ifainew_core::ai::Message>,
    event_id: String,
    enable_tools: Option<bool>,
    project_root: Option<String>,
) -> Result<(), String> {
    // =============================================================================
    // RAG & @codebase Explicit Handling
    // =============================================================================
    if let Some(root) = &project_root {
        // Find the last user message to check for @codebase
        let mut codebase_query = None;
        if let Some(last_msg) = messages.iter().filter(|m| m.role == "user").last() {
            if let ifainew_core::ai::Content::Text(text) = &last_msg.content {
                let lower_text = text.to_lowercase();
                if lower_text.contains("@codebase") {
                    // Extract query by stripping @codebase (case-insensitive)
                    let clean_query = text.to_string();
                    // Use regex for robust replacement
                    if let Ok(re) = regex::Regex::new("(?i)@codebase") {
                        let temp = re.replace_all(&clean_query, "").to_string();
                        let final_query = temp.trim().to_string();
                        codebase_query = Some(if final_query.is_empty() { "overview of the project structure and main logic".to_string() } else { final_query });
                    }
                }
            }
        }

        let mut final_system_prompt = prompt_manager::get_main_system_prompt(root);

        // If @codebase was triggered, perform RAG and inject context
        if let Some(query) = codebase_query {
            println!("[AI Chat] @codebase detected. Checking RAG index state...");
            
            let is_initialized = {
                let guard = state.index.lock().unwrap();
                guard.is_some()
            };

            if !is_initialized {
                println!("[AI Chat] RAG index NOT initialized. Attempting automatic init...");
                let _ = ifainew_core::rag::init_rag_index(app.clone(), state.clone(), root.clone()).await;
            }

            match ifainew_core::rag::build_context(state, query, root.clone()).await {
                Ok(rag_result) => {
                    if !rag_result.context.is_empty() {
                        // Safety: Limit context size to avoid exceeding token limits
                        let truncated_context = if rag_result.context.len() > 12000 {
                            format!("{}... [Context Truncated]", &rag_result.context[..12000])
                        } else {
                            rag_result.context
                        };

                        println!("[AI Chat] RAG context successfully built ({} chars)", truncated_context.len());
                        final_system_prompt.push_str("\n\nProject Context (Use this to answer codebase questions):\n");
                        final_system_prompt.push_str(&truncated_context);
                        
                        let _ = app.emit(&format!("{}_references", event_id), &rag_result.references);
                        let _ = app.emit("codebase-references", rag_result.references);
                    }
                },
                Err(e) => eprintln!("[AI Chat] RAG search failed: {}", e),
            }
        }

        // DEDUPLICATION STRATEGY: 
        // 1. Remove ALL existing system messages from the list
        messages.retain(|m| m.role != "system");
        // 2. Insert our unified enriched system message at the very top
        messages.insert(0, ifainew_core::ai::Message {
            role: "system".to_string(),
            content: ifainew_core::ai::Content::Text(final_system_prompt),
            tool_calls: None,
            tool_call_id: None,
        });

        // =============================================================================
        // Conversation Management: Auto Summarization
        // =============================================================================
        if let Err(e) = conversation::auto_summarize(root, &provider_config, &mut messages).await {
            eprintln!("[Conversation] Summarization error: {}", e);
        }
    }
        
    // =============================================================================
    // Message Sanitization Logic (Shared Utility)
    // =============================================================================
    ai_utils::sanitize_messages(&mut messages);
    // =============================================================================

    ifainew_core::ai::stream_chat(app, provider_config, messages, event_id, enable_tools.unwrap_or(true)).await
}

#[tauri::command]
async fn ai_completion(
    provider_config: ifainew_core::ai::AIProviderConfig,
    messages: Vec<ifainew_core::ai::Message>,
) -> Result<String, String> {
    ifainew_core::ai::complete_code(provider_config, messages).await
}

#[tauri::command]
async fn create_window(app: tauri::AppHandle, label: String, title: String, url: String) -> Result<(), String> {
    let window_builder = tauri::WebviewWindowBuilder::new(&app, label, tauri::WebviewUrl::App(url.into()))
        .title(title)
        .inner_size(1000.0, 800.0);
    
    match window_builder.build() {
        Ok(_) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(TerminalManager::new())
        .manage(LspManager::new())
        .manage(Supervisor::new())
                .on_window_event(|window, event| {
                    match event {
                        tauri::WindowEvent::CloseRequested { .. } => {
                            if window.label() == "main" {
                                window.app_handle().exit(0);
                            }
                        }
                        tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) => {
                            let _ = window.emit("tauri://file-drop", paths.clone());
                        }
                        _ => {}
                    }
                })
        .manage(ifainew_core::RagState::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            ai_chat,
            ai_completion,
            create_window,
            file_walker::get_all_file_paths,
            terminal::create_pty,
            terminal::write_pty,
            terminal::resize_pty,
            terminal::kill_pty,
            search::search_in_files,
            git::get_git_statuses,
            lsp::start_lsp,
            lsp::send_lsp_message,
            lsp::kill_lsp,
            ifainew_core::rag::init_rag_index,
            ifainew_core::rag::search_semantic,
            ifainew_core::rag::search_hybrid,
            ifainew_core::rag::build_context,
            ifainew_core::agent::agent_write_file,
            ifainew_core::agent::agent_read_file,
            ifainew_core::agent::agent_list_dir,
            commands::prompt_commands::list_prompts,
            commands::prompt_commands::get_prompt,
            commands::prompt_commands::update_prompt,
            commands::prompt_commands::render_prompt_template,
            commands::agent_commands::launch_agent,
            commands::agent_commands::list_running_agents,
            commands::agent_commands::approve_agent_action,
            performance::detect_gpu_info,
            performance::is_on_battery,
            performance::get_display_refresh_rate
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
