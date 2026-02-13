use serde::{Deserialize, Serialize};
use rust_embed::RustEmbed;
use crate::project_config;

pub mod storage;
pub mod template;
pub mod variables;

#[derive(RustEmbed)]
#[folder = "../.ifai/prompts/"]
pub struct BuiltinPrompts;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AccessTier {
    #[serde(rename = "public")]
    Public,
    #[serde(rename = "protected")]
    Protected,
    #[serde(rename = "private")]
    Private,
}

pub fn get_main_system_prompt(project_root: &str) -> String {
    let variables = variables::collect_system_variables(project_root);
    
    let lang = project_config::load_project_config_sync(project_root)
        .and_then(|c| c.default_language)
        .unwrap_or_else(|| "en".to_string());
    let is_zh = lang.to_lowercase().starts_with("zh");

    let template = {
        let local_root = if is_zh {
            std::path::Path::new(project_root).join(".ifai/prompts/zh-CN/system")
        } else {
            std::path::Path::new(project_root).join(".ifai/prompts/system")
        };
        
        let override_path = local_root.join("main.override.md");
        let local_path = local_root.join("main.md");
        let builtin_path = if is_zh { "zh-CN/system/main.md" } else { "system/main.md" };

        if override_path.exists() {
            storage::load_prompt(&override_path).ok()
        } else if local_path.exists() {
            storage::load_prompt(&local_path).ok()
        } else if let Some(content_file) = BuiltinPrompts::get(builtin_path) {
            let content = std::str::from_utf8(content_file.data.as_ref()).unwrap_or("");
            storage::load_prompt_from_str(content, None).ok()
        } else {
            // Fallback to English builtin if zh-CN builtin not found
            BuiltinPrompts::get("system/main.md").and_then(|f| {
                let content = std::str::from_utf8(f.data.as_ref()).unwrap_or("");
                storage::load_prompt_from_str(content, None).ok()
            })
        }
    };

    let mut prompt = match template {
        Some(t) => template::render_template(&t.content, &variables).unwrap_or_else(|_| t.content),
        None => "You are a helpful AI programming assistant.".to_string(),
    };

    if let Some(ifai_config) = project_config::load_project_config_sync(project_root) {
        if let Some(instructions) = ifai_config.custom_instructions {
            if !instructions.trim().is_empty() {
                prompt.push_str("\n\n# Project-Specific Instructions\n");
                prompt.push_str(&instructions);
            }
        }
    }

    prompt
}

pub fn get_agent_prompt(agent_type: &str, project_root: &str, task_description: &str) -> String {
    let mut variables = variables::collect_system_variables(project_root);

    let (clean_task, proposal_id) = extract_proposal_context(task_description);
    variables.insert("TASK_DESCRIPTION".to_string(), clean_task.to_string());

    if let Some(pid) = &proposal_id {
        variables.insert("PROPOSAL_ID".to_string(), pid.clone());
        variables.insert("PROPOSAL_CONTEXT".to_string(), format!("提案 ID: {}", pid));
    }

    // 🏆 v0.3.6: 多语言与回退路由逻辑
    let lang = project_config::load_project_config_sync(project_root)
        .and_then(|c| c.default_language)
        .unwrap_or_else(|| "en".to_string());
    let is_zh = lang.to_lowercase().starts_with("zh");

    let base_name = if agent_type == "task-breakdown" && proposal_id.is_some() {
        "task-breakdown-enhanced".to_string()
    } else {
        agent_type.to_lowercase().replace(" ", "-")
    };

    let template_name = if is_zh {
        format!("zh-CN/agents/{}.md", base_name)
    } else {
        format!("agents/{}.md", base_name)
    };

    let template = {
        let local_path = std::path::Path::new(project_root).join(".ifai/prompts").join(&template_name);

        if local_path.exists() {
            storage::load_prompt(&local_path).ok()
        } else if let Some(content_file) = BuiltinPrompts::get(&template_name) {
            let content = std::str::from_utf8(content_file.data.as_ref()).unwrap_or("");
            storage::load_prompt_from_str(content, None).ok()
        } else if is_zh {
            // 回退到英文
            let fallback_name = format!("agents/{}.md", base_name);
            BuiltinPrompts::get(&fallback_name).and_then(|f| {
                let content = std::str::from_utf8(f.data.as_ref()).unwrap_or("");
                storage::load_prompt_from_str(content, None).ok()
            })
        } else {
            None
        }
    };

    let mut prompt = match template {
        Some(t) => template::render_template(&t.content, &variables).unwrap_or_else(|_| t.content),
        None => format!("You are a specialized {} agent. Task: {}", agent_type, clean_task),
    };

    if let Some(ifai_config) = project_config::load_project_config_sync(project_root) {
        if let Some(instructions) = ifai_config.custom_instructions {
            if !instructions.trim().is_empty() {
                prompt.push_str("\n\n# Project-Specific Instructions\n");
                prompt.push_str(&instructions);
            }
        }
    }

    prompt
}

fn extract_proposal_context(task: &str) -> (String, Option<String>) {
    use regex::Regex;
    let re = Regex::new(r"^\\[PROPOSAL:([^\\]]+)\\]\\s*").unwrap();
    if let Some(caps) = re.captures(task) {
        if let Some(proposal_id) = caps.get(1) {
            let clean_task = re.replace(task, "").to_string();
            return (clean_task, Some(proposal_id.as_str().to_string()));
        }
    }
    (task.to_string(), None)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptMetadata {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default = "default_access_tier")]
    pub access_tier: AccessTier,
    #[serde(default)]
    pub variables: Vec<String>,
    #[serde(default)]
    pub tools: Vec<String>,
}

fn default_version() -> String { "1.0.0".to_string() }
fn default_access_tier() -> AccessTier { AccessTier::Public }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptTemplate {
    pub metadata: PromptMetadata,
    pub content: String,
    pub raw_text: String,
    pub path: Option<String>,
}
