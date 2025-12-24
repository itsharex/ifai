/**
 * 版本特性管理系统
 */

// 判断是否为商业版
export const IS_COMMERCIAL = 
    import.meta.env.MODE === 'commercial' || 
    (import.meta.env as any).APP_EDITION === 'commercial';

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
