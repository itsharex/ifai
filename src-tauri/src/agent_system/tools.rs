use ifainew_core::agent;
use serde_json::Value;

pub async fn execute_tool_internal(
    tool_name: &str,
    args: &Value,
    project_root: &str,
) -> Result<String, String> {
    println!("[AgentTools] Executing tool: {} with args: {}", tool_name, args);
    
    match tool_name {
        "agent_read_file" => {
            let rel_path = args["rel_path"].as_str()
                .or_else(|| args["file_path"].as_str()) // Handle common alias
                .unwrap_or("")
                .to_string();
            agent::agent_read_file(project_root.to_string(), rel_path).await
        },
        "agent_list_dir" => {
            let rel_path = args["rel_path"].as_str()
                .or_else(|| args["dir_path"].as_str())
                .unwrap_or(".")
                .to_string();
            let result = agent::agent_list_dir(project_root.to_string(), rel_path).await?;
            Ok(result.join("\n"))
        },
        "agent_write_file" => {
            // For now, let's allow writing in sub-agents if requested, 
            // but we might want to add a manual approval step later.
            let rel_path = args["rel_path"].as_str().unwrap_or("").to_string();
            let content = args["content"].as_str().unwrap_or("").to_string();
            agent::agent_write_file(project_root.to_string(), rel_path, content).await
        },
        _ => Err(format!("Tool {} not implemented or allowed in Agent System", tool_name))
    }
}
