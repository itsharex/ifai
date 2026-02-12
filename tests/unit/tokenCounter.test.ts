import { describe, it, expect, vi } from 'vitest';
import { getModelMaxTokens } from '../../src/utils/tokenCounter';

// Mock the tauri invoke since we are importing from a file that uses it,
// although getModelMaxTokens is a pure function, the file import might trigger side effects or other function calls if not careful.
// However, the import shows it just exports functions. `getModelMaxTokens` doesn't use `invoke`.
// But the file imports `invoke`. We might need to mock it if the test runner executes the import.

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('tokenCounter', () => {
  describe('getModelMaxTokens', () => {
    it('should return correct limit for exact match glm-4.7', () => {
      expect(getModelMaxTokens('glm-4.7')).toBe(128000);
    });

    it('should return correct limit for z-ai/glm4.7 (NVIDIA/Custom format)', () => {
      // This is the case suspect to be failing (returning 4096 instead of 128000)
      expect(getModelMaxTokens('z-ai/glm4.7')).toBe(128000);
    });

    it('should fall back to default for unknown models', () => {
      expect(getModelMaxTokens('unknown-model')).toBe(4096);
    });
  });
});
