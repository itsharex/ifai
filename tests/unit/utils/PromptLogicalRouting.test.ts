import { describe, it, expect } from "vitest";

// 模拟逻辑路径提取
function getLogicalPath(path: string): string {
  // 移除语言前缀，获取逻辑上的唯一标识
  return path.replace(/^(zh-CN|en-US|en)\//, "");
}

describe("Prompt Logical Routing", () => {
  it("should collapse localized paths to logical paths", () => {
    expect(getLogicalPath("zh-CN/system/main.md")).toBe("system/main.md");
    expect(getLogicalPath("system/main.md")).toBe("system/main.md");
  });
});
