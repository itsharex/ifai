// Wrapper for core library useChatStore
// Handles dependency injection of file and settings stores

import { useChatStore as coreUseChatStore, registerStores } from 'ifainew-core';
import { useFileStore } from './fileStore';
import { useSettingsStore } from './settingsStore';

// Register stores on first import
registerStores(useFileStore, useSettingsStore);

// Re-export the core chatStore
export const useChatStore = coreUseChatStore;

// Re-export types
export type { ChatState, ToolCall, Message, ContentPart, ImageUrl, BackendMessage, AIProviderConfig } from 'ifainew-core';
