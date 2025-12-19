use std::fs;
use std::path::Path;
use anyhow::{Result, Context};
use crate::prompt_manager::{PromptMetadata, PromptTemplate};

pub fn load_prompt(path: &Path) -> Result<PromptTemplate> {
    let content = fs::read_to_string(path)
        .with_context(|| format!("Failed to read prompt file: {:?}", path))?;

    let (metadata, markdown_content) = parse_front_matter(&content)?;

    Ok(PromptTemplate {
        metadata,
        content: markdown_content.to_string(),
        path: Some(path.to_string_lossy().to_string()),
    })
}

pub fn parse_front_matter(content: &str) -> Result<(PromptMetadata, &str)> {
    let trimmed = content.trim_start();
    if trimmed.starts_with("---") {
        let after_start = &trimmed[3..];
        if let Some(end) = after_start.find("---") {
            let yaml_str = &after_start[..end];
            let metadata: PromptMetadata = serde_yaml::from_str(yaml_str)
                .with_context(|| format!("Failed to parse YAML front matter. Content: {}", yaml_str))?;
                
            return Ok((metadata, after_start[end+3..].trim_start()));
        }
    }
    
    Err(anyhow::anyhow!("Invalid prompt format: Missing YAML front matter starting with ---"))
}
