import { RiskPolicy, RiskContext } from '../RiskPolicy';

describe('RiskPolicy', () => {
  let policy: RiskPolicy;

  beforeEach(() => {
    policy = new RiskPolicy();
  });

  describe('calculatePathRisk', () => {
    it('should identify critical config files as high risk', () => {
      expect((policy as any).calculatePathRisk('package.json')).toBe('high');
      expect((policy as any).calculatePathRisk('.env')).toBe('high');
      expect((policy as any).calculatePathRisk('.git/config')).toBe('high');
      expect((policy as any).calculatePathRisk('src-tauri/tauri.conf.json')).toBe('high');
    });

    it('should identify source code as medium risk', () => {
      expect((policy as any).calculatePathRisk('src/main.tsx')).toBe('medium');
      expect((policy as any).calculatePathRisk('src/components/App.tsx')).toBe('medium');
    });

    it('should identify docs and tests as low risk', () => {
      expect((policy as any).calculatePathRisk('README.md')).toBe('low');
      expect((policy as any).calculatePathRisk('docs/guide.md')).toBe('low');
      expect((policy as any).calculatePathRisk('tests/smoke.test.ts')).toBe('low');
    });

    it('should handle nested paths and traversal attempts', () => {
      expect((policy as any).calculatePathRisk('./package.json')).toBe('high');
      expect((policy as any).calculatePathRisk('src/../package.json')).toBe('high');
    });
  });

  describe('calculateRisk', () => {
    it('should prioritize path risk for critical files', () => {
      const context: RiskContext = {
        toolName: 'agent_write_file',
        args: { rel_path: 'package.json' },
        editorMode: 'standard'
      };
      expect(policy.calculateRisk(context)).toBe('high');
    });

    it('should allow low risk for safe paths even for write tools', () => {
      const context: RiskContext = {
        toolName: 'agent_write_file',
        args: { rel_path: 'README.md' },
        editorMode: 'standard'
      };
      // 路径是 low，虽然工具是 medium，但最终评估应向路径倾斜或取两者的高值？
      // 按照设计：低风险路径在特定模式下应放行，这里我们先预期它为 low
      expect(policy.calculateRisk(context)).toBe('low');
    });

    it('should still treat destructive tools as high risk regardless of path', () => {
      const context: RiskContext = {
        toolName: 'agent_delete_file',
        args: { rel_path: 'README.md' },
        editorMode: 'standard'
      };
      expect(policy.calculateRisk(context)).toBe('high');
    });

    it('should adjust risk based on editorMode (vibe mode behavior)', () => {
      const context: RiskContext = {
        toolName: 'agent_write_file',
        args: { rel_path: 'src/main.ts' },
        editorMode: 'vibe'
      };
      // Vibe 模式下写普通文件仍为 high
      expect(policy.calculateRisk(context)).toBe('high');
    });
  });
});
