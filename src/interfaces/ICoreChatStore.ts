import { Message, ToolCall } from '../stores/chatStore';

/**
 * Core interface for ChatStore state and actions
 * Represents the essential functionality needed for integration and sync
 */
export interface ICoreChatStore {
  messages: Message[];
  isLoading: boolean;
  addMessage: (message: Message) => void;
  updateMessageContent: (id: string, content: string, toolCalls?: ToolCall[]) => void;
  setLoading: (loading: boolean) => void;
  approveToolCall: (messageId: string, toolCallId: string, options?: { skipContinue?: boolean }) => Promise<void>;
  rejectToolCall: (messageId: string, toolCallId: string) => Promise<void>;
  
  // Custom properties for UI integration (optional)
  latestEditorMode?: string;
}

/**
 * Interface for the Inline Edit Store (UI state)
 */
export interface IInlineEditStore {
  isInlineEditVisible: boolean;
  pivoStage: 'plan' | 'implement' | 'complete' | 'idle';
  modifiedCode: string;
  pivoTasks: Array<{
    id: string;
    description: string;
    status: 'running' | 'success' | 'failed' | 'pending';
    stage: 'plan' | 'implement';
  }>;
}

/**
 * Type for the zustand store instance
 */
export interface IStoreInstance<T> {
  getState: () => T;
  setState: (fn: (state: T) => Partial<T> | Partial<T>, replace?: boolean) => void;
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
}
