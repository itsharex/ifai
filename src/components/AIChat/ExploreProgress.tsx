/**
 * ExploreProgress Component
 *
 * Displays real-time progress for explore agent operations:
 * - Phase indicator (scanning/analyzing)
 * - Overall progress bar
 * - Directory tree progress with hierarchical structure
 * - Current path being scanned
 */

import React, { useMemo } from 'react';
import { Search, Folder, FolderOpen, File, CheckCircle2, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface ExploreProgressData {
  phase: 'scanning' | 'analyzing' | 'completed';
  currentPath?: string;
  currentFile?: string;
  progress: {
    total: number;
    scanned: number;
    byDirectory: Record<string, {
      total: number;
      scanned: number;
      status: 'pending' | 'scanning' | 'completed';
    }>;
  };
  scannedFiles?: string[]; // Track recently scanned files for animation
}

interface ExploreProgressProps {
  progress: ExploreProgressData;
  mode?: 'full' | 'compact' | 'minimal'; // Display mode
}

// ============================================================================
// Helper Components
// ============================================================================

const PhaseIndicator: React.FC<{ phase: 'scanning' | 'analyzing' | 'completed' }> = ({ phase }) => {
  const phases = [
    { key: 'scanning', label: '扫描', icon: Search },
    { key: 'analyzing', label: '分析', icon: File },
  ];

  const currentIndex = phase === 'completed' ? phases.length : phases.findIndex(p => p.key === phase);
  const isComplete = phase === 'completed';

  return (
    <div className="flex items-center gap-2 mb-3">
      {phases.map((p, index) => {
        const Icon = p.icon;
        const isActive = phase === p.key && !isComplete;
        const isCompleted = index < currentIndex || (isComplete && index <= currentIndex);

        return (
          <React.Fragment key={p.key}>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
              isActive
                ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                : isCompleted
                ? 'bg-green-600/20 border-green-500 text-green-400'
                : 'bg-gray-800 border-gray-700 text-gray-500'
            }`}>
              <Icon size={14} />
              <span className="text-xs font-medium">{p.label}</span>
              {isActive && (
                <Loader2 size={12} className="animate-spin ml-1" />
              )}
              {isCompleted && !isActive && (
                <CheckCircle2 size={12} className="ml-1" />
              )}
            </div>
            {index < phases.length - 1 && (
              <div className={`w-8 h-0.5 ${
                index < currentIndex || isComplete ? 'bg-green-500' : 'bg-gray-700'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const ProgressBar: React.FC<{ current: number; total: number; isComplete?: boolean }> = ({ current, total, isComplete }) => {
  const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-400">
          {isComplete ? '扫描完成' : '总体进度'}
        </span>
        <span className={`text-xs font-medium ${
          isComplete ? 'text-green-400' : 'text-gray-300'
        }`}>{percentage}%</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ease-out ${
            isComplete ? 'bg-green-500' : 'bg-gradient-to-r from-blue-600 to-blue-400'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {current} / {total} 个目录
      </div>
    </div>
  );
};

// Dynamic file scan list - shows recently scanned files
const ScannedFileList: React.FC<{
  currentFile?: string;
  isComplete?: boolean;
}> = ({ currentFile, isComplete }) => {
  const [scannedFiles, setScannedFiles] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (currentFile && !scannedFiles.includes(currentFile)) {
      setScannedFiles(prev => [currentFile, ...prev].slice(0, 8)); // Keep last 8 files
    }
  }, [currentFile]);

  // Extract file name from path for display
  const getFileName = (filePath: string): string => {
    const parts = filePath.split('/');
    return parts[parts.length - 1] || filePath;
  };

  // Get directory name for context
  const getDirName = (filePath: string): string | undefined => {
    const lastSlash = filePath.lastIndexOf('/');
    if (lastSlash > 0) {
      const dirPath = filePath.substring(0, lastSlash);
      const dirParts = dirPath.split('/');
      return dirParts[dirParts.length - 1];
    }
    return undefined;
  };

  if (scannedFiles.length === 0 && !isComplete && !currentFile) {
    return null;
  }

  return (
    <div className="mt-3">
      <div className="text-xs text-gray-400 font-medium mb-2">最近扫描</div>
      <div className="bg-gray-800/50 rounded-lg p-2 max-h-[120px] overflow-hidden">
        <div className="space-y-1">
          {scannedFiles.map((file, index) => {
            const fileName = getFileName(file);
            const dirName = getDirName(file);
            return (
              <div
                key={file}
                className="flex items-center gap-2 text-xs py-1 px-2 rounded animate-in slide-in-from-right-2"
                style={{ animationDuration: `${200 + index * 50}ms` }}
              >
                <File size={12} className="text-gray-500 flex-shrink-0" />
                <span className="flex-1 truncate text-gray-400">{fileName}</span>
                {dirName && (
                  <span className="text-[9px] text-gray-600 truncate max-w-[60px]" title={file}>
                    {dirName}/
                  </span>
                )}
                <CheckCircle2 size={10} className="text-green-500 flex-shrink-0" />
              </div>
            );
          })}
          {currentFile && !scannedFiles.includes(currentFile) && (
            <div className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-blue-900/20">
              <File size={12} className="text-blue-400 flex-shrink-0" />
              <span className="flex-1 truncate text-blue-300">
                {getFileName(currentFile)}
              </span>
              {getDirName(currentFile) && (
                <span className="text-[9px] text-blue-500/70 truncate max-w-[60px]" title={currentFile}>
                  {getDirName(currentFile)}/
                </span>
              )}
              <Loader2 size={10} className="text-blue-500 animate-spin flex-shrink-0" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Streaming file list - new files flow from top, old files scroll down
interface FileStreamItem {
  path: string;
  status: 'scanning' | 'completed';
  timestamp: number;
}

export interface ScannedFileStreamProps {
  currentFile?: string;
  isComplete?: boolean;
  compact?: boolean;
  scannedCount?: number;
  totalCount?: number;
  scannedFiles?: string[];
}

export const ScannedFileStream: React.FC<ScannedFileStreamProps> = ({
  currentFile,
  isComplete,
  compact = false,
  scannedCount = 0,
  totalCount = 0,
  scannedFiles: externalFiles = []
}) => {
  const MAX_FILES = compact ? 5 : 6;
  const fileStreamRef = React.useRef<Set<string>>(new Set());
  const [fileStream, setFileStream] = React.useState<FileStreamItem[]>([]);

  // Initialize from external scannedFiles list
  React.useEffect(() => {
    if (externalFiles.length > 0 && fileStream.length === 0) {
      console.log('[ScannedFileStream] Initializing from scannedFiles:', externalFiles);
      const newStream: FileStreamItem[] = externalFiles.slice(0, MAX_FILES).map(path => ({
        path,
        status: 'completed' as const,
        timestamp: Date.now()
      }));
      newStream.forEach(f => fileStreamRef.current.add(f.path));
      setFileStream(newStream);
    }
  }, [externalFiles, MAX_FILES]);

  // Debug log to track currentFile changes
  React.useEffect(() => {
    console.log('[ScannedFileStream] State:', {
      currentFile,
      isComplete,
      fileStreamLength: fileStream.length,
      scannedCount,
      totalCount,
      externalFilesLength: externalFiles.length
    });
  }, [currentFile, isComplete, fileStream.length, scannedCount, totalCount, externalFiles.length]);

  // Add new file at the top when currentFile changes
  React.useEffect(() => {
    if (currentFile && !fileStreamRef.current.has(currentFile)) {
      console.log('[ScannedFileStream] Adding new file to stream:', currentFile);
      fileStreamRef.current.add(currentFile);
      const newEntry: FileStreamItem = {
        path: currentFile,
        status: 'scanning',
        timestamp: Date.now()
      };
      // Add new file at the beginning, limit total count
      setFileStream(prev => [newEntry, ...prev].slice(0, MAX_FILES));
    }
  }, [currentFile, MAX_FILES]);

  // Mark all as completed when scan finishes
  React.useEffect(() => {
    if (isComplete && fileStream.length > 0) {
      console.log('[ScannedFileStream] Marking all as completed');
      setFileStream(prev => prev.map(f => ({ ...f, status: 'completed' as const })));
    }
  }, [isComplete, fileStream.length]);

  // Update current file status when currentFile changes
  React.useEffect(() => {
    if (currentFile) {
      setFileStream(prev => prev.map(f =>
        f.path === currentFile && f.status !== 'scanning'
          ? { ...f, status: 'scanning' as const }
          : f.path !== currentFile && f.status === 'scanning'
          ? { ...f, status: 'completed' as const }
          : f
      ));
    }
  }, [currentFile]);

  // Extract file name from path
  const getFileName = (filePath: string): string => {
    const parts = filePath.split('/');
    return parts[parts.length - 1] || filePath;
  };

  if (fileStream.length === 0 && !isComplete) {
    return (
      <div className={`bg-gray-800/50 rounded-lg p-${compact ? '1.5' : '2'}`}>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <Loader2 size={compact ? 8 : 10} className="animate-spin text-blue-500" />
          <span>正在准备扫描...</span>
        </div>
      </div>
    );
  }

  // Show completion summary when scan is done but no files in stream
  if (fileStream.length === 0 && isComplete) {
    return (
      <div className={`bg-gray-800/50 rounded-lg p-${compact ? '1.5' : '2'}`}>
        <div className="flex items-center gap-2 text-[10px] text-gray-500">
          <CheckCircle2 size={compact ? 8 : 10} className="text-green-500 flex-shrink-0" />
          <span>扫描完成: {scannedCount} 个文件</span>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? "mt-2" : "mt-3"}>
      <div className="text-xs text-gray-400 font-medium mb-2">
        {compact ? '扫描文件' : '最近扫描'}
      </div>
      <div className={`bg-gray-800/50 rounded-lg p-${compact ? '1.5' : '2'} max-h-[${compact ? '100' : '120'}px] overflow-hidden`}>
        <div className="space-y-0.5">
          {fileStream.map((file, index) => {
            const fileName = getFileName(file.path);
            const isScanning = file.status === 'scanning';

            return (
              <div
                key={`${file.path}-${file.timestamp}`}
                className={`
                  flex items-center gap-${compact ? '1.5' : '2'} text-${compact ? '[9px]' : '[10px]'} py-${compact ? '0.5' : '1'} px-${compact ? '1.5' : '2'} rounded
                  transition-all duration-300
                  ${isScanning
                    ? 'bg-blue-900/30 animate-in slide-in-from-top-2 fade-in'
                    : 'animate-in fade-in'}
                `}
              >
                {isScanning ? (
                  <Loader2 size={compact ? 8 : 10} className="text-blue-500 animate-spin flex-shrink-0" />
                ) : (
                  <CheckCircle2 size={compact ? 8 : 10} className="text-green-500 flex-shrink-0" />
                )}
                <span className={`flex-1 truncate ${
                  isScanning ? 'text-blue-400' : 'text-gray-400'
                }`}>
                  {fileName}
                </span>
              </div>
            );
          })}
          {currentFile && !fileStream.some(f => f.path === currentFile) && (
            <div
              className={`
                flex items-center gap-${compact ? '1.5' : '2'} text-${compact ? '[9px]' : '[10px]'} py-${compact ? '0.5' : '1'} px-${compact ? '1.5' : '2'} rounded bg-blue-900/30
                animate-in slide-in-from-top-2 fade-in
              `}
            >
              <Loader2 size={compact ? 8 : 10} className="text-blue-500 animate-spin flex-shrink-0" />
              <span className="flex-1 truncate text-blue-400">
                {getFileName(currentFile)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Build tree structure from flat directory list
interface TreeNode {
  name: string;
  path: string;
  status: 'pending' | 'scanning' | 'completed';
  children: TreeNode[];
  depth: number;
}

const buildDirectoryTree = (byDirectory: Record<string, any>): TreeNode[] => {
  const paths = Object.keys(byDirectory).sort();

  // Filter out empty paths and normalize
  const validPaths = paths.filter(p => p && p !== '.').map(p => {
    // Remove "./" prefix if present
    return p.startsWith('./') ? p.substring(2) : p;
  });

  if (validPaths.length === 0) {
    return [];
  }

  const root: TreeNode = { name: '', path: '', status: 'pending', children: [], depth: 0 };

  validPaths.forEach(fullPath => {
    const status = byDirectory[fullPath]?.status || byDirectory[`./${fullPath}`]?.status || 'pending';
    const parts = fullPath.split('/').filter(p => p);

    let current = root;
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let child = current.children.find(c => c.name === part);

      if (!child) {
        child = {
          name: part,
          path: currentPath,
          status: index === parts.length - 1 ? status : 'pending',
          children: [],
          depth: index + 1
        };
        current.children.push(child);
      }

      // Update status if this is the actual directory being scanned
      if (index === parts.length - 1) {
        child.status = status;
      }

      current = child;
    });
  });

  return root.children;
};

const DirectoryTreeNode: React.FC<{
  node: TreeNode;
  isExpanded?: boolean;
}> = ({ node, isExpanded }) => {
  const [expanded, setExpanded] = React.useState(isExpanded ?? node.depth <= 2);
  const hasChildren = node.children.length > 0;

  const getStatusIcon = () => {
    switch (node.status) {
      case 'completed':
        return <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />;
      case 'scanning':
        return <Loader2 size={14} className="text-blue-500 animate-spin flex-shrink-0" />;
      default:
        return hasChildren ? (
          expanded ? (
            <FolderOpen size={14} className="text-yellow-500 flex-shrink-0" />
          ) : (
            <Folder size={14} className="text-yellow-500/50 flex-shrink-0" />
          )
        ) : (
          <Folder size={14} className="text-gray-600 flex-shrink-0" />
        );
    }
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 hover:bg-gray-800/50 rounded cursor-pointer ${
          node.status === 'scanning' ? 'bg-blue-900/20' : ''
        }`}
        style={{ paddingLeft: `${(node.depth - 1) * 12 + 4}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren && (
          <span className="text-gray-500">
            {expanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
          </span>
        )}
        {!hasChildren && <span className="w-3" />}
        {getStatusIcon()}
        <span className={`text-xs truncate ${
          node.status === 'scanning' ? 'text-blue-400 font-medium' :
          node.status === 'completed' ? 'text-gray-400' :
          'text-gray-500'
        }`}>
          {node.name}
        </span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <DirectoryTreeNode key={child.path} node={child} />
          ))}
        </div>
      )}
    </div>
  );
};

const DirectoryTreeProgress: React.FC<{
  byDirectory: ExploreProgressData['progress']['byDirectory'];
  compact?: boolean;
}> = ({ byDirectory, compact }) => {
  const tree = useMemo(() => buildDirectoryTree(byDirectory), [byDirectory]);
  const hasAnyData = Object.keys(byDirectory).length > 0;

  if (compact) {
    // Compact mode: show flat list with active directories (scanning/pending)
    const activePaths = Object.entries(byDirectory)
      .filter(([_, data]) => data.status === 'scanning' || data.status === 'pending')
      .sort(([_, a], [__, b]) => {
        // Scanning directories first, then by path
        if (a.status === 'scanning' && b.status !== 'scanning') return -1;
        if (a.status !== 'scanning' && b.status === 'scanning') return 1;
        return 0;
      })
      .map(([path, _]) => path)
      .filter(p => p && p !== '.')
      .slice(0, 5);

    if (activePaths.length === 0 && !hasAnyData) {
      return null;
    }

    return (
      <div className="mt-2 space-y-0.5">
        {activePaths.map(path => {
          const status = byDirectory[path]?.status;
          const displayPath = path.startsWith('./') ? path.substring(2) : path;
          // Show last 2 path segments for better context
          const parts = displayPath.split('/');
          const name = parts[parts.length - 1] || displayPath;
          const parentDir = parts.length > 1 ? parts[parts.length - 2] : null;
          const displayName = parentDir ? `${parentDir}/${name}` : name;

          return (
            <div
              key={path}
              className={`flex items-center gap-1.5 text-[9px] py-0.5 px-1.5 rounded ${
                status === 'scanning'
                  ? 'bg-blue-900/20'
                  : 'bg-gray-800/30'
              }`}
            >
              {status === 'scanning' ? (
                <Loader2 size={8} className="text-blue-500 animate-spin flex-shrink-0" />
              ) : (
                <Folder size={8} className="text-gray-500 flex-shrink-0" />
              )}
              <span className={`flex-1 truncate ${
                status === 'scanning' ? 'text-blue-400' : 'text-gray-500'
              }`}>
                {displayName}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="text-xs text-gray-400 font-medium mb-2">目录结构</div>
      <div className="bg-gray-800/50 rounded-lg p-2 max-h-[200px] overflow-y-auto">
        {!hasAnyData ? (
          <div className="text-xs text-gray-500 py-2">正在初始化扫描...</div>
        ) : tree.length === 0 ? (
          <div className="text-xs text-gray-500 py-2">正在扫描目录...</div>
        ) : (
          tree.map(node => (
            <DirectoryTreeNode key={node.path} node={node} />
          ))
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ExploreProgress: React.FC<ExploreProgressProps> = ({ progress, mode = 'full' }) => {
  // Backwards compatibility
  const compact = mode === 'compact';
  const { phase, currentPath, currentFile, progress: data } = progress;
  const percentage = data.total > 0 ? Math.min(100, Math.round((data.scanned / data.total) * 100)) : 0;
  const isComplete = data.scanned >= data.total && data.total > 0;

  // Debug log to track data flow
  console.log('[ExploreProgress] Render:', {
    mode,
    phase,
    currentFile,
    scanned: data.scanned,
    total: data.total,
    dirCount: Object.keys(data.byDirectory).length,
    scannedFilesCount: progress.scannedFiles?.length || 0,
    scannedFiles: progress.scannedFiles
  });

  // Minimal mode - only progress bar and phase (for top "analysis" area)
  if (mode === 'minimal') {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
        {/* Compact Phase Indicator */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isComplete ? (
              <CheckCircle2 size={14} className="text-green-500" />
            ) : phase === 'scanning' ? (
              <Loader2 size={14} className="text-blue-500 animate-spin" />
            ) : (
              <Search size={14} className="text-purple-500" />
            )}
            <span className="text-xs font-medium text-gray-300">
              {isComplete ? '扫描完成' : phase === 'scanning' ? '扫描中' : '分析中'}
            </span>
          </div>
          <span className={`text-xs font-medium ${
            isComplete ? 'text-green-400' : 'text-gray-400'
          }`}>{percentage}%</span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isComplete ? 'bg-green-500' : phase === 'analyzing' ? 'bg-purple-500' : 'bg-blue-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-gray-500">{data.scanned} / {data.total} 目录</span>
          <span className="text-[10px] text-gray-500">{progress.scannedFiles?.length || 0} 文件</span>
        </div>
      </div>
    );
  }

  if (compact) {
    const [showDirectories, setShowDirectories] = React.useState(false); // Default collapsed
    const hasScannedFiles = (progress.scannedFiles && progress.scannedFiles.length > 0);
    const hasDirectoryData = Object.keys(data.byDirectory).length > 0;

    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
        {/* DEBUG: Show phase value */}
        <div className="mb-2 p-1 bg-yellow-900/20 border border-yellow-500/30 rounded text-[9px] text-yellow-400">
          [调试] phase={phase}, currentFile={currentFile ? currentFile.split('/').pop() : 'null'}, scannedFiles={progress.scannedFiles?.length || 0}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {isComplete ? (
              <CheckCircle2 size={14} className="text-green-500" />
            ) : phase === 'scanning' ? (
              <Loader2 size={14} className="text-blue-500 animate-spin" />
            ) : phase === 'analyzing' ? (
              <Search size={14} className="text-purple-500" />
            ) : (
              <Search size={14} className="text-gray-400" />
            )}
            <span className="text-xs font-medium text-gray-300">
              {isComplete ? '扫描完成' : phase === 'scanning' ? '扫描中' : phase === 'analyzing' ? '分析中' : '探索中'}
            </span>
          </div>
          <span className={`text-xs ${
            isComplete ? 'text-green-400' : 'text-gray-500'
          }`}>{percentage}%</span>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full transition-all duration-300 ${
              isComplete ? 'bg-green-500' : phase === 'analyzing' ? 'bg-purple-500' : 'bg-blue-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Collapsible Directories Section - Secondary, Collapsed by default */}
        {hasDirectoryData && (
          <div className="mb-2">
            <button
              onClick={() => setShowDirectories(!showDirectories)}
              className="flex items-center gap-1.5 text-[9px] text-gray-500 font-medium hover:text-gray-400 transition-colors mb-1"
            >
              {showDirectories ? (
                <ChevronDown size={10} />
              ) : (
                <ChevronRight size={10} />
              )}
              <span>目录详情 ({Object.keys(data.byDirectory).length})</span>
            </button>
            {showDirectories && (
              <DirectoryTreeProgress byDirectory={data.byDirectory} compact={true} />
            )}
          </div>
        )}

        {/* 📁 Scanned Files Section - BOTTOM ACTIVITY AREA, Always Show when scanning or has files */}
        {(phase === 'scanning' || phase === 'analyzing' || hasScannedFiles || currentFile) && (
          <div className="bg-blue-900/10 border border-blue-500/30 rounded-lg p-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <File size={10} className="text-blue-400" />
                <span className="text-[10px] font-medium text-blue-300">
                  {phase === 'scanning' ? '正在扫描' : phase === 'analyzing' ? '分析中' : '扫描文件'}
                </span>
                {phase === 'scanning' && (
                  <Loader2 size={8} className="text-blue-500 animate-spin" />
                )}
                {phase === 'analyzing' && (
                  <Search size={8} className="text-purple-500 animate-pulse" />
                )}
                {isComplete && (
                  <CheckCircle2 size={8} className="text-green-500" />
                )}
              </div>
              <span className="text-[9px] text-gray-500">
                {progress.scannedFiles?.length || 0} 文件
              </span>
            </div>
            <ScannedFileStream
              currentFile={isComplete ? undefined : currentFile}
              isComplete={isComplete}
              compact={true}
              scannedCount={data.scanned}
              totalCount={data.total}
              scannedFiles={progress.scannedFiles}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 my-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-blue-500" />
          <span className="text-sm font-medium text-gray-200">
            {isComplete ? '扫描完成' : '探索中'}
          </span>
        </div>
        {currentFile && !isComplete && (
          <div className="text-xs text-gray-500 truncate max-w-[200px]" title={currentFile}>
            {currentFile.split('/').pop()}
          </div>
        )}
      </div>

      {/* Phase Indicator */}
      <PhaseIndicator phase={phase} />

      {/* Overall Progress */}
      <ProgressBar current={data.scanned} total={data.total} isComplete={isComplete} />
    </div>
  );
};

export default ExploreProgress;
