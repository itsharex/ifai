import { describe, it, expect } from "vitest";

// 模拟后端的路径路由算法
function resolvePromptPath(agentId: string, lang: string, rootDir: string = ".ifai/prompts"): string {
  // 核心算法：优先检查 lang 子目录，再回退到根目录
  if (lang.startsWith("zh")) {
    return `${rootDir}/zh-CN/agents/${agentId}.md`;
  }
  return `${rootDir}/agents/${agentId}.md`;
}

describe("Prompt I18n Routing Logic", () => {
  it("should route to zh-CN directory for Chinese language", () => {
    const path = resolvePromptPath("bash_agent", "zh-CN");
    expect(path).toBe(".ifai/prompts/zh-CN/agents/bash_agent.md");
  });

  it("should route to root directory for English language", () => {
    const path = resolvePromptPath("bash_agent", "en-US");
    expect(path).toBe(".ifai/prompts/agents/bash_agent.md");
  });
});
