import { ApprovalCoordinator } from './coordinators/ApprovalCoordinator';
import { FileSystemExecutor } from './executors/FileSystemExecutor';
import { invoke } from '@tauri-apps/api/core';
import { useFileStore } from '../../stores/fileStore';

let instance: ApprovalCoordinator | null = null;

export function getApprovalCoordinator(): ApprovalCoordinator {
  if (!instance) {
    console.log('[ApprovalEngine] 🚀 PIVO 2.0 Engine Initializing...');
    instance = new ApprovalCoordinator();
    
    // 🔥 修复：动态获取当前项目根目录
    const rootPath = useFileStore.getState().rootPath || '';
    const fsExecutor = new FileSystemExecutor(invoke, rootPath);
    
    const fsTools = [
      "agent_write_file", "agent_read_file", "agent_list_dir", 
      "agent_delete_file", "agent_list_functions", 
      "agent_read_file_range", "agent_scan_project"
    ];
    
    fsTools.forEach(tool => {
      instance!.registerExecutor(tool, fsExecutor);
    });
    console.log(`[ApprovalEngine] ✅ Registered ${fsTools.length} FS tools.`);
  }
  return instance;
}
