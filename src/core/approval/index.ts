import { ApprovalCoordinator } from './coordinators/ApprovalCoordinator';
import { FileSystemExecutor } from './executors/FileSystemExecutor';
import { ShellExecutor } from './executors/ShellExecutor';
import { SearchExecutor } from './executors/SearchExecutor';
import { SymbolExecutor } from './executors/SymbolExecutor';
import { invoke } from '@tauri-apps/api/core';
import { useFileStore } from '../../stores/fileStore';

let instance: ApprovalCoordinator | null = null;

/**
 * 🚀 PIVO 3.0: 增强型审批协调器获取函数
 * 实现 rootPath 的物理级实时对齐
 */
export function getApprovalCoordinator(): ApprovalCoordinator {
  const currentRootPath = useFileStore.getState().rootPath || '';

  if (!instance) {
    console.log('[ApprovalEngine] 🚀 PIVO 2.0 Engine Initializing...');
    instance = new ApprovalCoordinator();
  }

  // 🏆 物理级实时路径校准
  const fsExecutor = new FileSystemExecutor(invoke, currentRootPath);
  const fsTools = [
    "agent_write_file", "agent_read_file", "agent_list_dir", 
    "agent_delete_file", "agent_list_functions", 
    "agent_read_file_range", "agent_scan_project",
    "write_file", "read_file"
  ];
  fsTools.forEach(tool => instance!.registerExecutor(tool, fsExecutor));

  const searchExecutor = new SearchExecutor(invoke, currentRootPath);
  const searchTools = ["agent_search", "search_semantic", "agent_batch_read", "init_rag_index"];
  searchTools.forEach(tool => instance!.registerExecutor(tool, searchExecutor));

  const symbolExecutor = new SymbolExecutor(invoke, currentRootPath);
  const symbolTools = ["get_file_symbols", "agent_list_functions"];
  symbolTools.forEach(tool => instance!.registerExecutor(tool, symbolExecutor));

  // 🏆 物理级实时 Shell 校准 (解决 agent_execute_command 缺失问题)
  const shellExecutor = new ShellExecutor(invoke);
  const shellTools = ["bash", "agent_bash", "agent_execute_command", "execute_bash_command", "agent_run_shell_command", "agent_run_shell"];
  shellTools.forEach(tool => instance!.registerExecutor(tool, shellExecutor));

  return instance;
}
