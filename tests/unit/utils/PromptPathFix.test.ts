import { describe, it, expect } from "vitest";

function resolveI18nPath(lang: string, internalPath: string): string {
  const langCode = lang.startsWith("zh") ? "zh-CN" : lang;
  if (internalPath.startsWith(langCode + "/")) {
    return internalPath;
  }
  return langCode + "/" + internalPath;
}

describe("Prompt Path I18n Normalization", () => {
  it("should not double prefix if path already has zh-CN", () => {
    const result = resolveI18nPath("zh-CN", "zh-CN/system/main.md");
    expect(result).toBe("zh-CN/system/main.md");
  });

  it("should prefix if path is raw", () => {
    const result = resolveI18nPath("zh-CN", "system/main.md");
    expect(result).toBe("zh-CN/system/main.md");
  });
});
