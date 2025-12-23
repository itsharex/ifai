use crate::core_traits::ai::{AIService, AIProviderConfig, Message};
use crate::core_traits::rag::RagService;
use crate::core_traits::agent::AgentService;
use crate::ai_utils;

pub struct BasicAIService;

#[async_trait::async_trait]
impl AIService for BasicAIService {
    async fn chat(
        &self,
        config: &AIProviderConfig,
        messages: Vec<Message>,
    ) -> Result<Message, String> {
        ai_utils::fetch_ai_completion(config, messages, None).await
    }

    async fn stream_chat(
        &self,
        config: &AIProviderConfig,
        messages: Vec<Message>,
        _event_id: &str,
        callback: Box<dyn Fn(String) + Send>,
    ) -> Result<(), String> {
        // Simple implementation that calls fetch_ai_completion and calls callback with full content
        // This simulates streaming by sending the whole content at once
        // TODO: Implement true streaming in ai_utils for community edition
        match ai_utils::fetch_ai_completion(config, messages, None).await {
            Ok(msg) => {
                match msg.content {
                    crate::core_traits::ai::Content::Text(text) => {
                        callback(text);
                    }
                    _ => {}
                }
                Ok(())
            }
            Err(e) => Err(e),
        }
    }
}

pub struct CommunityRagService;

#[async_trait::async_trait]
impl RagService for CommunityRagService {
    async fn index_project(&self, _root: &str) -> Result<(), String> {
        Err("RAG indexing is available in Commercial Edition.".to_string())
    }

    async fn search(&self, _query: &str, _top_k: usize) -> Result<Vec<String>, String> {
        Ok(vec![])
    }

    async fn retrieve_context(&self, _query: &str, _root: &str) -> Result<crate::core_traits::rag::RagResult, String> {
        Ok(crate::core_traits::rag::RagResult {
            context: String::new(),
            references: vec![],
        })
    }
}

pub struct CommunityAgentService;

#[async_trait::async_trait]
impl AgentService for CommunityAgentService {
    async fn execute_task(&self, _task: &str) -> Result<String, String> {
        Err("Agent system is available in Commercial Edition.".to_string())
    }
}
