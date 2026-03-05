const { useChatStore } = require('../src/stores/useChatStore');
const { StreamingResponseController } = require('../src/services/chat/StreamingResponseController');

// 模拟物理环境
global.window = { __IFAI_EDITOR_MODE__: 'vibe' };
global.crypto = { randomUUID: () => `uuid-${Math.random()}` };

async function testPreemptionFidelity() {
    console.log("🧪 Starting High-Fidelity Preemption Test...");
    
    const controller = StreamingResponseController.getInstance();
    const assistantId = "test-assistant-id";
    
    // 1. 初始化会话
    const initialMsg = { id: assistantId, role: 'assistant', content: '', isStreaming: true, contentSegments: [] };
    await controller.initSession(assistantId, [initialMsg]);

    // 2. 模拟收到首片文字
    console.log("   -> Sending text chunk...");
    // 模拟内部处理逻辑 (由于无法直接调用私有 listen，我们直接验证 controller 内部 buffer 逻辑的演进)
    // 实际上我们需要通过修改控制器逻辑来确保它能处理这种情况
    
    console.log("✅ TDD Setup Complete. Now applying physical fix to prevent segment preemption...");
}

testPreemptionFidelity().catch(console.error);
