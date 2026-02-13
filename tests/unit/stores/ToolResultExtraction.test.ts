import { describe, it, expect } from "vitest";

// 模拟前端提取逻辑的纯函数版（用于验证算法）
function extractContent(result: any): string {
  if (result === undefined || result === null) return "undefined";
  if (typeof result === "string") {
    try {
      const parsed = JSON.parse(result);
      return parsed.content !== undefined ? String(parsed.content) : result;
    } catch (e) {
      return result;
    }
  }
  if (typeof result === "object") {
    return result.content !== undefined ? String(result.content) : JSON.stringify(result);
  }
  return String(result);
}

describe("Tool Result Extraction Logic", () => {
  it("should extract content from raw string", () => {
    expect(extractContent("hello world")).toBe("hello world");
  });

  it("should extract content from JSON object", () => {
    expect(extractContent({ content: "file data", size: 100 })).toBe("file data");
  });

  it("should extract content from JSON string", () => {
    expect(extractContent(JSON.stringify({ content: "json data" }))).toBe("json data");
  });

  it("should handle array results (like agent_list_dir)", () => {
    const list = ["file1", "file2"];
    expect(extractContent(list)).toBe(JSON.stringify(list));
  });

  it("should handle undefined/null gracefully", () => {
    expect(extractContent(undefined)).toBe("undefined");
  });
});
