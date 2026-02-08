import React, { useEffect, useState } from 'react';
import { RefreshCw, Puzzle, ExternalLink, ShieldCheck, Download } from 'lucide-react';
import { useSkillStore } from '../../stores/skillStore';
import { invoke } from '@tauri-apps/api/core';
import { useFileStore } from '../../stores/fileStore';
import clsx from 'clsx';

export const SkillsSettings: React.FC = () => {
    const { 
        availableSkills, 
        activeSkillIds, 
        isLoading, 
        fetchSkills, 
        toggleSkill 
    } = useSkillStore();

    const [isInstalling, setIsInstalling] = useState(false);

    // 初始加载
    useEffect(() => {
        if (availableSkills.length === 0) {
            fetchSkills();
        }
    }, []);

    const installDemo = async () => {
        const rootPath = useFileStore.getState().rootPath;
        if (!rootPath) return;
        
        setIsInstalling(true);
        try {
            await invoke('init_skills_dir', { projectRoot: rootPath });
            await fetchSkills();
        } catch (e) {
            console.error('Failed to install demo skills:', e);
        } finally {
            setIsInstalling(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#252526] text-gray-300 p-4 overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    <Puzzle size={20} className="text-blue-400" />
                    <h3 className="text-lg font-medium text-white">技能中心 (Skills Center)</h3>
                </div>
                <button 
                    onClick={() => fetchSkills()}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#37373d] hover:bg-[#45454d] disabled:opacity-50 rounded text-sm transition-colors text-white"
                    aria-label="刷新"
                >
                    <RefreshCw size={14} className={clsx(isLoading && "animate-spin")} />
                    <span>刷新</span>
                </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {isLoading && (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                        <RefreshCw size={32} className="animate-spin mb-4" />
                        <p>正在扫描技能目录...</p>
                    </div>
                )}

                {!isLoading && availableSkills.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 border border-dashed border-gray-700 rounded-lg bg-[#1e1e1e]">
                        <ShieldCheck size={48} className="text-gray-600 mb-4" />
                        <p className="text-gray-400">未发现可用技能</p>
                        <p className="text-xs text-gray-500 mt-2 mb-6 text-center px-8">
                            IfAI 会自动扫描项目根目录下 .ifai/skills 中的技能插件。<br/>
                            您可以安装内置示例来快速开始体验。
                        </p>
                        <button
                            onClick={installDemo}
                            disabled={isInstalling}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-sm transition-colors shadow-lg"
                        >
                            {isInstalling ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                            <span>安装内置示例技能</span>
                        </button>
                    </div>
                )}

                {!isLoading && availableSkills.map(skill => {
                    const isActive = activeSkillIds.includes(skill.id);
                    return (
                        <div 
                            key={skill.id}
                            className={clsx(
                                "flex items-start gap-4 p-4 rounded-lg border transition-all",
                                isActive 
                                    ? "bg-[#2a2d2e] border-blue-500/50 shadow-lg shadow-blue-500/5" 
                                    : "bg-[#1e1e1e] border-gray-700 hover:border-gray-600"
                            )}
                        >
                            <div className={clsx(
                                "p-2 rounded-md",
                                isActive ? "bg-blue-500/20 text-blue-400" : "bg-gray-800 text-gray-500"
                            )}>
                                <Puzzle size={24} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium text-white truncate">{skill.name}</h4>
                                    <span className="px-1.5 py-0.5 rounded bg-gray-800 text-[10px] font-mono text-gray-400 uppercase border border-gray-700">
                                        v{skill.version}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">
                                    {skill.description}
                                </p>
                            </div>

                            <div className="flex flex-col items-end gap-4">
                                {/* Toggle Switch */}
                                <button
                                    onClick={() => toggleSkill(skill.id)}
                                    className={clsx(
                                        "relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none",
                                        isActive ? "bg-blue-600" : "bg-gray-700"
                                    )}
                                >
                                    <span
                                        className={clsx(
                                            "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                                            isActive ? "translate-x-6" : "translate-x-1"
                                        )}
                                    />
                                </button>
                                
                                <button className="text-gray-500 hover:text-white transition-colors" title="查看源码">
                                    <ExternalLink size={14} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer Tip */}
            <div className="mt-4 pt-4 border-t border-gray-700 text-[11px] text-gray-500 italic">
                提示：激活技能后，AI 将自动获得该领域的增强指令。
            </div>
        </div>
    );
};
