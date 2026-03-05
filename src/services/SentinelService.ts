import { ToolCall } from '../stores/chatStore';

/**
 * PIVO 3.0 Sentinel Service
 * Monitors tool calls and enforces physical layer integrity (Anti-Hallucination)
 */
export class SentinelService {
  private static activeUuid: string | null = null;

  /**
   * Scans the conversation history for a dynamic UUID injected by E2E tests
   * @param messages Conversation messages
   */
  static scanForUuid(messages: any[]) {
    if (process.env.NODE_ENV !== 'test' && !(window as any).IFAI_TEST_MODE) return;

    // Look for UUID in the most recent user messages
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'user') {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        const match = content.match(/PIVO_UUID:([a-zA-Z0-9-]+)/);
        if (match) {
          this.activeUuid = match[1];
          console.log(`[Sentinel] 🛡️ Captured active UUID: ${this.activeUuid}`);
          break;
        }
      }
    }
  }

  /**
   * Hook executed before tool invocation
   * @param tool Tool name
   * @param args Tool arguments
   */
  static beforeExecute(tool: string, args: any) {
    if (!this.activeUuid) return;

    console.log(`[Sentinel] 🔍 Intercepting ${tool} call...`);
    
    // If the tool is supposed to write content, verify it contains the UUID
    if (tool.includes('write') || tool.includes('replace')) {
      const content = args.content || '';
      if (content.includes(this.activeUuid)) {
        console.log(`[Sentinel] ✅ Physical integrity verified: Tool content contains UUID.`);
      } else {
        console.warn(`[Sentinel] ⚠️ PROBABLE HALLUCINATION: Tool content DOES NOT contain required UUID ${this.activeUuid}`);
        // In strict mode, we could block the call here
      }
    }
  }

  /**
   * Hook executed after tool invocation
   * @param tool Tool name
   * @param result Tool execution result
   */
  static afterExecute(tool: string, result: any) {
    if (!this.activeUuid) return;

    // If the tool is reading content that was injected with a UUID
    const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
    if (resultStr.includes(this.activeUuid)) {
       console.log(`[Sentinel] ✅ Physical bridge verified: Tool result contains UUID.`);
    }
  }

  /**
   * Gets the active UUID
   */
  static getActiveUuid() {
    return this.activeUuid;
  }
}
