import { ApprovalCoordinator } from './coordinators/ApprovalCoordinator';
import { FileSystemExecutor } from './executors/FileSystemExecutor';
import { ShellExecutor } from './executors/ShellExecutor';
import { invoke } from '@tauri-apps/api/core';
import { useFileStore } from '../../stores/fileStore';

let instance: ApprovalCoordinator | null = null;

export function getApprovalCoordinator(): ApprovalCoordinator {
  if (!instance) {
    console.log('[ApprovalEngine] 🚀 PIVO 2.0 Engine Initializing...');
    instance = new ApprovalCoordinator();
    
    // 1. 初始化文件执行器
    const rootPath = useFileStore.getState().rootPath || '';
    const fsExecutor = new FileSystemExecutor(invoke, rootPath);
    const fsTools = [
      "agent_write_file", "agent_read_file", "agent_list_dir", 
      "agent_delete_file", "agent_list_functions", 
      "agent_read_file_range", "agent_scan_project"
    ];
    fsTools.forEach(tool => instance!.registerExecutor(tool, fsExecutor));

    // 2. 初始化 Shell 执行器
    const shellExecutor = new ShellExecutor(invoke);
    const shellTools = ["bash", "agent_execute_command", "execute_bash_command", "agent_run_shell_command"];
    shellTools.forEach(tool => instance!.registerExecutor(tool, shellExecutor));
    
    console.log(`[ApprovalEngine] ✅ Registered ${fsTools.length} FS tools & ${shellTools.length} Shell tools.`);
  }
  return instance;
}
