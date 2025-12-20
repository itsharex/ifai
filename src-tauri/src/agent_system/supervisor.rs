use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, oneshot};
use crate::agent_system::base::{AgentStatus};

#[derive(Debug)]
pub struct AgentHandle {
    pub id: String,
    pub agent_type: String,
    pub status: AgentStatus,
    pub join_handle: Option<tokio::task::JoinHandle<()>>,
}

#[derive(Clone)]
pub struct Supervisor {
    pub agents: Arc<Mutex<HashMap<String, AgentHandle>>>,
    // Map of agent_id -> oneshot sender to resume the task
    pub approval_txs: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
}

impl Supervisor {
    pub fn new() -> Self {
        Self {
            agents: Arc::new(Mutex::new(HashMap::new())),
            approval_txs: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn register_agent(&self, id: String, agent_type: String) {
        let mut agents = self.agents.lock().await;
        agents.insert(id.clone(), AgentHandle {
            id,
            agent_type,
            status: AgentStatus::Idle,
            join_handle: None,
        });
    }

    pub async fn update_status(&self, id: &str, status: AgentStatus) {
        let mut agents = self.agents.lock().await;
        if let Some(agent) = agents.get_mut(id) {
            agent.status = status;
        }
    }

    pub async fn list_agents(&self) -> Vec<(String, String, AgentStatus)> {
        let agents = self.agents.lock().await;
        agents.values()
            .map(|a| (a.id.clone(), a.agent_type.clone(), a.status.clone()))
            .collect()
    }

    // --- Approval Mechanism ---

    pub async fn wait_for_approval(&self, id: String) -> bool {
        let (tx, rx) = oneshot::channel();
        {
            let mut txs = self.approval_txs.lock().await;
            txs.insert(id, tx);
        }
        
        // This will block the async task until someone calls notify_approval
        rx.await.unwrap_or(false)
    }

    pub async fn notify_approval(&self, id: &str, approved: bool) {
        let mut txs = self.approval_txs.lock().await;
        if let Some(tx) = txs.remove(id) {
            let _ = tx.send(approved);
        }
    }
}