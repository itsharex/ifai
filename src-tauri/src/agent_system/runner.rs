use tauri::{AppHandle, Emitter};
use crate::agent_system::base::{AgentStatus, AgentContext};
use crate::agent_system::supervisor::Supervisor;
use crate::agent_system::tools;
use crate::prompt_manager;
use ifainew_core::ai::{Message, Content, AIProtocol, ToolCall};
use serde_json::{json, Value};
use reqwest::Client;

pub async fn run_agent_task(
    app: AppHandle,
    supervisor: Supervisor,
    id: String,
    agent_type: String,
    context: AgentContext,
) {
    println!("[AgentRunner] Starting task for: {} ({})", id, agent_type);
    
    // 1. Initial Setup
    let mut history: Vec<Message> = Vec::new();
    let system_prompt = prompt_manager::get_agent_prompt(&agent_type, &context.project_root, &context.task_description);
    
    history.push(Message {
        role: "system".to_string(),
        content: Content::Text(system_content_with_tools(&system_prompt)),
        tool_calls: None,
        tool_call_id: None,
    });

    history.push(Message {
        role: "user".to_string(),
        content: Content::Text(context.task_description.clone()),
        tool_calls: None,
        tool_call_id: None,
    });

    let _ = supervisor.update_status(&id, AgentStatus::Running).await;
    
    // Define available tools for the AI
    let tools = vec![
        json!({
            "type": "function",
            "function": {
                "name": "agent_list_dir",
                "description": "List files in a directory",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "rel_path": { "type": "string", "description": "Relative path to directory" }
                    }
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "agent_read_file",
                "description": "Read content of a file",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "rel_path": { "type": "string", "description": "Relative path to file" }
                    },
                    "required": ["rel_path"]
                }
            }
        })
    ];

    // 2. Main Loop (Autonomous Thinking)
    let mut loop_count = 0;
    const MAX_LOOPS: usize = 12; // Increased slightly

    while loop_count < MAX_LOOPS {
        loop_count += 1;
        println!("[AgentRunner] Loop {} for agent {}", loop_count, id);

        let _ = app.emit("agent:status", json!({ "id": id, "status": "running", "progress": 0.15 + (loop_count as f32 * 0.05) }));
        let _ = app.emit("agent:log", json!({ "id": id, "message": "AI is thinking..." }));

        // Call AI
        match fetch_ai_completion(&context.provider_config, history.clone(), Some(tools.clone())).await {
            Ok(ai_message) => {
                // Check for text content
                if let Content::Text(ref text) = ai_message.content {
                    if !text.is_empty() {
                         let event_name = format!("agent_{}", id);
                         let _ = app.emit(&event_name, json!({ "type": "content", "content": text }));
                    }
                }

                // Check for tool calls
                if let Some(tool_calls) = &ai_message.tool_calls {
                    if tool_calls.is_empty() {
                        break;
                    }

                    // Pre-push AI message to history
                    history.push(ai_message.clone());

                    for tool_call in tool_calls {
                        let tool_name = &tool_call.function.name;
                        let args_res: Result<Value, _> = serde_json::from_str(&tool_call.function.arguments);
                        
                        let _ = app.emit("agent:log", json!({ "id": id, "message": format!("Executing tool: {}", tool_name) }));

                        let tool_result = match args_res {
                            Ok(args) => {
                                match tools::execute_tool_internal(tool_name, &args, &context.project_root).await {
                                    Ok(res) => res,
                                    Err(e) => format!("Error: {}", e)
                                }
                            },
                            Err(e) => format!("Failed to parse arguments: {}", e)
                        };

                        // Add tool result to history
                        history.push(Message {
                            role: "tool".to_string(),
                            content: Content::Text(tool_result),
                            tool_calls: None,
                            tool_call_id: Some(tool_call.id.clone()),
                        });
                    }
                } else {
                    break;
                }
            },
            Err(e) => {
                let _ = app.emit("agent:status", json!({ "id": id, "status": "failed", "error": e }));
                return;
            }
        }
    }

    // 3. Finalize
    println!("[AgentRunner] Agent {} finished.", id);
    let _ = supervisor.update_status(&id, AgentStatus::Completed).await;
    let _ = app.emit("agent:status", json!({ "id": id, "status": "completed", "progress": 1.0 }));
}

fn system_content_with_tools(base: &str) -> String {
    format!("{}\n\nAlways use tools to explore the codebase or read files when needed. Do not guess.", base)
}

async fn fetch_ai_completion(
    config: &ifainew_core::ai::AIProviderConfig,
    messages: Vec<Message>,
    tools: Option<Vec<Value>>,
) -> Result<Message, String> {
    let client = Client::new();
    
    if !matches!(config.protocol, AIProtocol::OpenAI) {
        return Err("Agent System currently only supports OpenAI/DeepSeek protocols".to_string());
    }

    let mut request_body = json!({
        "model": config.models[0],
        "messages": messages,
        "stream": false
    });

    if let Some(t) = tools {
        request_body["tools"] = json!(t);
    }

    let response = client.post(&config.base_url)
        .header("Authorization", format!("Bearer {}", config.api_key))
        .json(&request_body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let err_body = response.text().await.unwrap_or_default();
        return Err(format!("AI API Error ({}): {}", status, err_body));
    }

    let res_json: Value = response.json().await.map_err(|e| e.to_string())?;
    
    let choice = &res_json["choices"][0]["message"];
    let role = choice["role"].as_str().unwrap_or("assistant").to_string();
    let content_text = choice["content"].as_str().unwrap_or("").to_string();
    
    let mut tool_calls: Option<Vec<ToolCall>> = None;
    if let Some(tc_array) = choice["tool_calls"].as_array() {
        let mut calls = Vec::new();
        for tc_val in tc_array {
            calls.push(ToolCall {
                id: tc_val["id"].as_str().unwrap_or("").to_string(),
                r#type: "function".to_string(),
                function: ifainew_core::ai::FunctionCall {
                    name: tc_val["function"]["name"].as_str().unwrap_or("").to_string(),
                    arguments: tc_val["function"]["arguments"].as_str().unwrap_or("{}").to_string(),
                }
            });
        }
        tool_calls = Some(calls);
    }

    Ok(Message {
        role,
        content: Content::Text(content_text),
        tool_calls,
        tool_call_id: None,
    })
}