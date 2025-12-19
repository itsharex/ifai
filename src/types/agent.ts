export type AgentStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'failed' | 'completed';

export interface Agent {
  id: string;
  name: string;
  type: string;
  status: AgentStatus;
  progress: number; // 0.0 to 1.0
  logs: string[];
  content?: string;
  currentStep?: string;
}

export interface AgentResult {
  agentId: string;
  status: AgentStatus;
  output: string;
  artifacts?: string[]; // file paths
}
