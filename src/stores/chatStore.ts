export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  apiKey: string;
  setApiKey: (key: string) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessageContent: (id: string, content: string) => void;
  setLoading: (loading: boolean) => void;
  sendMessage: (content: string) => Promise<void>;
}
