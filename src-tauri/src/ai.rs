use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use eventsource_stream::Eventsource;
use futures::StreamExt;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Serialize, Debug)]
struct ChatRequest {
    model: String,
    messages: Vec<Message>,
    stream: bool,
}

#[derive(Deserialize, Debug)]
struct DeepSeekResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize, Debug)]
struct Choice {
    delta: Delta,
    finish_reason: Option<String>,
}

#[derive(Deserialize, Debug)]
struct Delta {
    content: Option<String>,
}

pub async fn stream_chat(
    app: AppHandle,
    api_key: String,
    messages: Vec<Message>,
    event_id: String,
) -> Result<(), String> {
    println!("Starting chat request with {} messages", messages.len()); // Log 1
    let client = Client::new();
    let request = ChatRequest {
        model: "deepseek-chat".to_string(), // Or deepseek-coder
        messages,
        stream: true,
    };

    println!("Sending request to DeepSeek API..."); // Log 2
    let response = client
        .post("https://api.deepseek.com/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| {
            println!("Request failed: {}", e); // Log Error
            e.to_string()
        })?;

    println!("Response status: {}", response.status()); // Log Status

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        println!("API Error Body: {}", text); // Log API Error
        app.emit(&format!("{}_error", event_id), format!("API Error: {}", text)).unwrap_or(());
        return Err(format!("API Error: {}", text));
    }

    let mut stream = response
        .bytes_stream()
        .eventsource();

    println!("Stream started processing..."); // Log Stream Start

    while let Some(event) = stream.next().await {
        match event {
            Ok(event) => {
                println!("Received SSE event data: {}", event.data); // Log Event Data
                if event.data == "[DONE]" {
                    println!("Stream [DONE]");
                    break;
                }
                if let Ok(response) = serde_json::from_str::<DeepSeekResponse>(&event.data) {
                    if let Some(choice) = response.choices.first() {
                        if let Some(content) = &choice.delta.content {
                            // Emit event to frontend
                            // println!("Emitting content: {}", content); // Optional detailed log
                            app.emit(&event_id, content).unwrap_or(());
                        }
                    }
                } else {
                    println!("Failed to parse JSON: {}", event.data);
                }
            }
            Err(e) => {
                println!("Error reading stream: {}", e);
                app.emit(&format!("{}_error", event_id), e.to_string()).unwrap_or(());
                return Err(e.to_string());
            }
        }
    }
    
    // Emit finish event
    app.emit(&format!("{}_finish", event_id), "DONE").unwrap_or(());
    println!("Chat request finished.");

    Ok(())
}
