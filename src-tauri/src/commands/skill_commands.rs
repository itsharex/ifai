use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[cfg(feature = "commercial")]
use ifainew_core::skills::SkillRegistry;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SkillInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
}

#[tauri::command]
pub async fn get_available_skills(
    project_root: String,
) -> Result<Vec<SkillInfo>, String> {
    println!("[SkillCommand] Request received for root: {}", project_root);
    
    #[cfg(feature = "commercial")]
    {
        let mut skills_path = PathBuf::from(project_root);
        skills_path.push(".ifai");
        skills_path.push("skills");

        println!("[SkillCommand] Full scan path: {:?}", skills_path);

        if !skills_path.exists() {
            println!("[SkillCommand] Warning: Skills directory does not exist!");
            return Ok(vec![]);
        }

        let registry = SkillRegistry::new(skills_path);
        let skills = registry.discover().map_err(|e| e.to_string())?;

        println!("[SkillCommand] Successfully found {} skills", skills.len());

        Ok(skills.into_iter().map(|s| SkillInfo {
            id: s.id,
            name: s.name,
            description: s.description,
            version: s.version,
        }).collect())
    }

    #[cfg(not(feature = "commercial"))]
    {
        println!("[SkillCommand] Running in Community mode - returning empty list");
        Ok(vec![])
    }
}
