use std::collections::HashMap;
use std::path::PathBuf;
use std::fs;
use crate::prompt_manager::{PromptMetadata, PromptTemplate};
use crate::prompt_manager::storage;
use crate::prompt_manager::template;
use walkdir::WalkDir;

// Helper to get prompt root dir
// In production this should be configurable or follow XDG paths
fn get_prompt_root() -> PathBuf {
    PathBuf::from(".ifai/prompts")
}

#[tauri::command]
pub async fn list_prompts() -> Result<Vec<PromptTemplate>, String> {
    let root = get_prompt_root();
    let mut prompts = Vec::new();

    if !root.exists() {
        return Ok(prompts);
    }

    for entry in WalkDir::new(&root).into_iter().filter_map(|e| e.ok()) {
        if entry.path().extension().map_or(false, |ext| ext == "md") {
            match storage::load_prompt(entry.path()) {
                Ok(mut template) => {
                    // Make path relative for frontend ID
                    if let Ok(rel) = entry.path().strip_prefix(&root) {
                         template.path = Some(rel.to_string_lossy().to_string());
                    }
                    prompts.push(template);
                },
                Err(e) => eprintln!("Failed to load prompt {:?}: {}", entry.path(), e),
            }
        }
    }

    Ok(prompts)
}

#[tauri::command]
pub async fn get_prompt(path: String) -> Result<PromptTemplate, String> {
    let root = get_prompt_root();
    let full_path = root.join(&path);
    
    storage::load_prompt(&full_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_prompt(path: String, content: String) -> Result<(), String> {
    let root = get_prompt_root();
    let full_path = root.join(&path);
    
    // Create dir if not exists (for new files)
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Validate structure
    let _ = storage::parse_front_matter(&content).map_err(|e| e.to_string())?;

    fs::write(full_path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn render_prompt_template(content: String, variables: HashMap<String, String>) -> Result<String, String> {
    template::render_template(&content, &variables).map_err(|e| e.to_string())
}
