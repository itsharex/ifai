use serde::{Serialize, Deserialize};
use regex::Regex;
use std::fs::File;
use std::io::{BufRead, BufReader};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SymbolInfo {
    pub name: String,
    pub kind: String,
    pub line: usize,
}

#[tauri::command]
pub async fn get_file_symbols(path: String) -> Result<Vec<SymbolInfo>, String> {
    println!("[SymbolScanner] Scanning file: {}", path);
    let file = File::open(&path).map_err(|e| format!("{}: {}", e, path))?;
    let reader = BufReader::new(file);
    let mut symbols = Vec::new();

    // 🚀 v0.3.5: 扩展正则范围 (支持 enum, struct, type 等)
    let re_func = Regex::new(r"(?:function|const|let|var|async\s+fn|fn)\s+([a-zA-Z0-9_]+)").unwrap();
    let re_struct = Regex::new(r"(?:class|interface|struct|enum|type)\s+([a-zA-Z0-9_]+)").unwrap();

    for (idx, line) in reader.lines().enumerate() {
        if let Ok(l) = line {
            let l = l.trim();
            if let Some(cap) = re_func.captures(l) {
                symbols.push(SymbolInfo { name: cap[1].to_string(), kind: "Function".into(), line: idx + 1 });
            } else if let Some(cap) = re_struct.captures(l) {
                symbols.push(SymbolInfo { name: cap[1].to_string(), kind: "Structure".into(), line: idx + 1 });
            }
        }
    }
    println!("[SymbolScanner] Found {} symbols", symbols.len());
    Ok(symbols)
}
