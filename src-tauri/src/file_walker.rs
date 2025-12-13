use tauri::{command, PathResolver};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[command]
pub async fn get_all_file_paths(root_dir: String) -> Result<Vec<String>, String> {
    let root_path = PathBuf::from(root_dir);
    if !root_path.exists() {
        return Err(format!("Directory does not exist: {}", root_path.display()));
    }

    let mut file_paths = Vec::new();
    for entry in WalkDir::new(&root_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        if let Some(path_str) = entry.path().to_str() {
            // Make path relative to root for cleaner display, or keep absolute
            // For now, keep absolute to match file system API.
            file_paths.push(path_str.to_string());
        }
    }
    Ok(file_paths)
}
