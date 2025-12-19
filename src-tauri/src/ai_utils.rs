use ifainew_core::ai::{Message, Content, AIProtocol, ToolCall, AIProviderConfig};
use serde_json::{json, Value};
use reqwest::Client;
use std::time::Duration;

pub fn sanitize_messages(messages: &mut Vec<Message>) {
    let mut i = 0;
    while i < messages.len() {
        // Only process assistant messages that have tool_calls
        if messages[i].role == "assistant" && messages[i].tool_calls.as_ref().map_or(false, |tc| !tc.is_empty()) {
            let tool_calls = messages[i].tool_calls.clone().unwrap();
            let mut completed_ids = std::collections::HashSet::new();

            // Scan forward to find all tool response messages
            let mut j = i + 1;
            while j < messages.len() && messages[j].role == "tool" {
                if let Some(id) = &messages[j].tool_call_id {
                    completed_ids.insert(id.clone());
                }
                j += 1;
            }

            // Filter to keep only tool_calls that have responses
            let filtered_calls: Vec<_> = tool_calls.into_iter()
                .filter(|tc| completed_ids.contains(&tc.id))
                .collect();

            if filtered_calls.is_empty() {
                // No completed calls - remove tool_calls field entirely
                messages[i].tool_calls = None;
            } else {
                // Update with only completed calls
                messages[i].tool_calls = Some(filtered_calls);
            }
        }
        i += 1;
    }
}

pub async fn fetch_ai_completion(
    config: &AIProviderConfig,
    mut messages: Vec<Message>, // Change to mutable to allow sanitization
    tools: Option<Vec<Value>>,
) -> Result<Message, String> {
    // Apply sanitization before every internal API call
    sanitize_messages(&mut messages);

    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    
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
        .map_err(|e| format!("Network/Request error: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let err_body = response.text().await.unwrap_or_default();
        eprintln!("[AIUtils] API HTTP Error {}: {}", status, err_body);
        return Err(format!("AI API Error ({}): {}", status, err_body));
    }

    let res_json: Value = response.json().await.map_err(|e| {
        eprintln!("[AIUtils] JSON Parse Error: {}", e);
        format!("Failed to parse AI response: {}", e)
    })?;
    
    let choice = &res_json["choices"][0]["message"];
    if choice.is_null() {
        eprintln!("[AIUtils] Error: 'choices[0].message' is missing in response: {}", res_json);
        return Err("Malformed AI response: message field missing".to_string());
    }

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