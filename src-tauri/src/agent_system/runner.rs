use tauri::{AppHandle, Emitter};
use crate::agent_system::base::{AgentStatus, AgentContext};
use crate::agent_system::supervisor::Supervisor;
use std::sync::Arc;

pub async fn run_agent_task(
    app: AppHandle,
    supervisor: Supervisor,
    id: String,
    agent_type: String,
    context: AgentContext,
) {
    println!("[AgentRunner] Starting task for agent: {} type: {}", id, agent_type);
    
    // Update status to running
    supervisor.update_status(&id, AgentStatus::Running).await;
    let _ = app.emit("agent:status", serde_json::json!({
        "id": id,
        "status": "running",
        "progress": 0.1
    }));

    // Simulate work for now
    // In next step, we will integrate ifainew_core::ai::complete_code
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

    let _ = app.emit("agent:log", serde_json::json!({
        "id": id,
        "message": format!("Analyzing task: {}", context.task_description)
    }));

    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    // Mark as completed
    supervisor.update_status(&id, AgentStatus::Completed).await;
    let _ = app.emit("agent:status", serde_json::json!({
        "id": id,
        "status": "completed",
        "progress": 1.0
    }));
    
    let _ = app.emit("agent:result", serde_json::json!({
        "id": id,
        "output": format!("Agent {} has finished processing the request.", agent_type)
    }));
}
