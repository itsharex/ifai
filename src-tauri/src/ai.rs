use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, command};
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

#[derive(Deserialize, Debug)]
struct NonStreamChoice {
    message: Message,
}

#[derive(Deserialize, Debug)]
struct NonStreamResponse {
    choices: Vec<NonStreamChoice>,
}

#[derive(Serialize, Debug)]
struct CompletionRequest {
    model: String,
    messages: Vec<Message>,
    stream: bool,
}

pub async fn stream_chat(
    app: AppHandle,
    api_key: String,
    messages: Vec<Message>,
    event_id: String,
) -> Result<(), String> {
    println!("Starting chat request with {} messages", messages.len());
    let client = Client::new();
    let request = ChatRequest {
        model: "deepseek-chat".to_string(), // Or deepseek-coder
        messages,
        stream: true,
    };

    println!("Sending request to DeepSeek API...");
    let response = client
        .post("https://api.deepseek.com/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| {
            println!("Request failed: {}", e);
            e.to_string()
        })?;

    println!("Response status: {}", response.status());

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        println!("API Error Body: {}", text);
        app.emit(&format!("{}_error", event_id), format!("API Error: {}", text)).unwrap_or(());
        return Err(format!("API Error: {}", text));
    }

    let mut stream = response
        .bytes_stream()
        .eventsource();

    println!("Stream started processing...");

    while let Some(event) = stream.next().await {
        match event {
            Ok(event) => {
                println!("Received SSE event data: {}", event.data);
                if event.data == "[DONE]" {
                    println!("Stream [DONE]");
                    break;
                }
                if let Ok(response) = serde_json::from_str::<DeepSeekResponse>(&event.data) {
                    if let Some(choice) = response.choices.first() {
                        if let Some(content) = &choice.delta.content {
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
    
    app.emit(&format!("{}_finish", event_id), "DONE").unwrap_or(());
    println!("Chat request finished.");

    Ok(())
}

#[command]
pub async fn ai_completion(
    api_key: String,
    messages: Vec<Message>,
) -> Result<String, String> {
    complete_code(api_key, messages).await
}

pub async fn complete_code(
    api_key: String,
    messages: Vec<Message>,
) -> Result<String, String> {
    let client = Client::new();
    let request = CompletionRequest {
        model: "deepseek-chat".to_string(), 
        messages,
        stream: false, // Non-streaming
    };

    let response = client
        .post("https://api.deepseek.com/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = response.status(); // Get status before consuming response body
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("API Error: {} - {}", status, text));
    }

    let body = response.json::<NonStreamResponse>().await.map_err(|e| e.to_string())?;
    
    if let Some(choice) = body.choices.first() {
        Ok(choice.message.content.clone())
    } else {
        Err("No choices returned".to_string())
    }
}
