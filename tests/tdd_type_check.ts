import { Message, ToolCall } from '../src/stores/chatStore';
import { InlineEditState } from '../src/stores/inlineEditStore';

// 验证 Message 接口缺失属性
const msg: Message = {
    id: "test",
    role: "assistant",
    content: "hello",
    // @ts-expect-error: isStreaming 应存在于 Message 接口中
    isStreaming: true
};

// 验证 ToolCall 状态枚举冲突
const tc: ToolCall = {
    id: "call_1",
    tool: "test_tool",
    args: {},
    // @ts-expect-error: status 应包含 'executed'
    status: 'executed'
};

// 验证 InlineEditState 缺失属性
const inlineState: Partial<InlineEditState> = {
    // @ts-expect-error
    pivoStage: 'plan',
    // @ts-expect-error
    pivoTasks: [],
    // @ts-expect-error
    modifiedFiles: [],
    // @ts-expect-error
    setPivoState: (stage: any) => {}
};

console.log("TDD: Type check simulation ready.");
