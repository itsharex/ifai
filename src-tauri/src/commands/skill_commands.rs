use serde::{Deserialize, Serialize};
use crate::AppState;
use std::path::PathBuf;

#[cfg(feature = "commercial")]
use ifainew_core::skills::Skill;

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
    #[cfg(feature = "commercial")]
    {
        let mut skills_path = PathBuf::from(project_root);
        skills_path.push(".ifai");
        skills_path.push("skills");

        let registry = ifainew_core::skills::SkillRegistry::new(skills_path);
        let skills = registry.discover().map_err(|e| e.to_string())?;

        Ok(skills.into_iter().map(|s| SkillInfo {
            id: s.id,
            name: s.name,
            description: s.description,
            version: s.version,
        }).collect())
    }

    #[cfg(not(feature = "commercial"))]
    {
        Ok(vec![])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use std::fs;

    #[tokio::test]
    async fn test_tauri_command_get_available_skills_bridge() {
        let dir = tempdir().unwrap();
        let skill_dir = dir.path().join(".ifai/skills/test-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(skill_dir.join("skill.json"), r#"{
            "id": "test", "name": "Test", "description": "x", "version": "1.0",
            "system_prompt": "x"
        }"#).unwrap();

        // 直接调用 Tauri 命令函数
        let result = get_available_skills(dir.path().to_string_lossy().to_string()).await;
        
        assert!(result.is_ok(), "Command should succeed");
        let skills = result.unwrap();
        assert_eq!(skills.len(), 1);
        assert_eq!(skills[0].id, "test");
        println!("✅ Bridge test passed: Tauri command successfully reached Core logic.");
    }
}