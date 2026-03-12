/**
 * 版本特性管理系统
 */

// 判断是否为商业版
// 通过 Vite define 注入或通过 mode 判断，并支持运行时物理覆盖 (针对 E2E)
export const IS_COMMERCIAL = 
    (typeof window !== 'undefined' && (window as any).__IFAI_EDITION__ === 'commercial') ||
    (process.env as any).APP_EDITION === 'commercial' || 
    import.meta.env.MODE === 'commercial';

export const EDITION_NAME = IS_COMMERCIAL ? 'Commercial' : 'Community';

/**
 * 功能特性开关清单
 */
export const FEATURES = {
    // RAG 语义搜索
    ragSearch: IS_COMMERCIAL,
    
    // Agent 系统全功能
    agentSystem: IS_COMMERCIAL,
    
    // 提示词管理 - 编辑能力
    promptEditing: IS_COMMERCIAL,
    
    // 提示词管理 - 查看能力 (双版本均有)
    promptViewing: true,
};

/**
 * 检查功能是否可用
 */
export function checkFeature(feature: keyof typeof FEATURES): boolean {
    return FEATURES[feature];
}
