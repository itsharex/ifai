import { AIProviderConfig } from './settingsStore';

export interface ToolCall {
  id: string;
  tool: string;
  args: any;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';
  result?: string;
}

export interface ImageUrl {
    url: string;
}

export interface ContentPart {
    type: 'text' | 'image_url';
    text?: string;
    image_url?: ImageUrl;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string; // Keep string content for backward compatibility
  multiModalContent?: ContentPart[]; // New field for multi-modal
  references?: string[];
  toolCalls?: ToolCall[];
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  addMessage: (message: Message) => void;
  updateMessageContent: (id: string, content: string) => void;
  setLoading: (loading: boolean) => void;
  sendMessage: (content: string | ContentPart[], providerId: string, modelName: string) => Promise<void>;
  toggleAutocomplete: () => void;
  approveToolCall: (messageId: string, toolCallId: string) => Promise<void>;
  rejectToolCall: (messageId: string, toolCallId: string) => Promise<void>;
  generateResponse: (history: any[], providerConfig: AIProviderConfig) => Promise<void>;
}
