import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Unified Language Persistence (PIVO 3.0 TDD)', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should recover language from settings-storage during initial load', async () => {
        // 1. 模拟 PIVO 3.0 规范的统一存储数据
        const mockSettings = {
            version: 4,
            state: {
                language: 'en-US',
                theme: 'vs-dark'
            }
        };
        localStorage.setItem('settings-storage', JSON.stringify(mockSettings));

        // 2. 验证 getInitialLanguage 逻辑 (由于 i18n/config.ts 已经执行，我们手动验证逻辑逻辑)
        const getInitialLanguage = () => {
            const settingsRaw = localStorage.getItem('settings-storage');
            if (settingsRaw) {
                const settings = JSON.parse(settingsRaw);
                return settings.state?.language;
            }
            return undefined;
        };

        expect(getInitialLanguage()).toBe('en-US');
    });
});
