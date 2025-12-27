import React, { useEffect, useRef } from 'react';
import {
  Copy,
  Scissors,
  Clipboard,
  FileText,
  Folder,
  Terminal,
  ExternalLink,
  RefreshCw,
  Trash2,
  Edit3,
  FilePlus,
  FolderPlus,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFileStore } from '../../stores/fileStore';
import {
  copyToClipboard,
  revealInFileManager,
  openInTerminal,
  createFile,
  createDirectory,
  deleteFile,
  renameFile,
} from '../../utils/fileSystem';
import { toast } from 'sonner';
import { platform } from '@tauri-apps/plugin-os';
import { FileNode } from '../../stores/types';

interface ContextMenuProps {
  x: number;
  y: number;
  node: FileNode | null;
  onClose: () => void;
  onRefresh: () => void;
  rootPath?: string;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  node,
  onClose,
  onRefresh,
  rootPath,
}) => {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const currentPlatform = platform();

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Close menu on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (!node) return null;

  const handleCopyPath = async () => {
    try {
      await copyToClipboard(node.path);
      toast.success(t('common.copiedToClipboard'));
    } catch (error) {
      toast.error(t('common.copyFailed'));
    }
    onClose();
  };

  const handleCopyRelativePath = async () => {
    try {
      const relativePath = rootPath
        ? node.path.replace(new RegExp(`^${rootPath}/?`), '')
        : node.path;
      await copyToClipboard(relativePath || node.path);
      toast.success(t('common.copiedToClipboard'));
    } catch (error) {
      toast.error(t('common.copyFailed'));
    }
    onClose();
  };

  const handleCopyName = async () => {
    try {
      await copyToClipboard(node.name);
      toast.success(t('common.copiedToClipboard'));
    } catch (error) {
      toast.error(t('common.copyFailed'));
    }
    onClose();
  };

  const handleOpenInTerminal = async () => {
    try {
      const dirPath = node.kind === 'directory' ? node.path : node.path.substring(0, node.path.lastIndexOf('/'));
      console.log('[ContextMenu] Opening terminal at:', dirPath);
      await openInTerminal(dirPath);
      console.log('[ContextMenu] Terminal opened successfully');
      toast.success('Terminal opened');
      onClose();
    } catch (error) {
      console.error('[ContextMenu] Failed to open terminal:', error);
      toast.error(t('common.openTerminalFailed'));
    }
  };

  const handleRevealInFileManager = async () => {
    try {
      console.log('[ContextMenu] Revealing file in manager:', node.path);
      await revealInFileManager(node.path);
      console.log('[ContextMenu] File revealed successfully');
      toast.success('File revealed');
      onClose();
    } catch (error) {
      console.error('[ContextMenu] Failed to reveal file:', error);
      toast.error(t('common.openFileManagerFailed'));
    }
  };

  const handleNewFile = async () => {
    const name = window.prompt(t('common.enterFileName'));
    if (name) {
      try {
        const dirPath = node.kind === 'directory' ? node.path : node.path.substring(0, node.path.lastIndexOf('/'));
        const newPath = `${dirPath}/${dirPath.endsWith('/') ? '' : '/'}${name}`;
        await createFile(newPath);
        toast.success(t('common.fileCreated'));
        onRefresh();
      } catch (error) {
        toast.error(t('common.createFileFailed'));
      }
    }
    onClose();
  };

  const handleNewFolder = async () => {
    const name = window.prompt(t('common.enterFolderName'));
    if (name) {
      try {
        const dirPath = node.kind === 'directory' ? node.path : node.path.substring(0, node.path.lastIndexOf('/'));
        const newPath = `${dirPath}/${dirPath.endsWith('/') ? '' : '/'}${name}`;
        await createDirectory(newPath);
        toast.success(t('common.folderCreated'));
        onRefresh();
      } catch (error) {
        toast.error(t('common.createFolderFailed'));
      }
    }
    onClose();
  };

  const handleRename = () => {
    const newName = window.prompt(t('common.renameTo'), node.name);
    if (newName && newName !== node.name) {
      const pathParts = node.path.split('/');
      pathParts.pop();
      const newPath = [...pathParts, newName].join('/');
      renameFile(node.path, newPath)
        .then(() => {
          toast.success(t('common.renamedSuccessfully', { newName }));
          onRefresh();
        })
        .catch(() => {
          toast.error(t('common.renameFailed'));
        });
    }
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm(t('common.confirmDeleteFile', { fileName: node.name }))) {
      deleteFile(node.path)
        .then(() => {
          toast.success(t('common.deletedSuccessfully'));
          onRefresh();
        })
        .catch(() => {
          toast.error(t('common.deleteFailed'));
        });
    }
    onClose();
  };

  const handleRefresh = () => {
    onRefresh();
    onClose();
  };

  // Get platform-specific label for "Reveal in File Manager"
  const getRevealLabel = () => {
    switch (currentPlatform) {
      case 'windows':
        return t('contextMenu.revealInExplorer');
      case 'macos':
        return t('contextMenu.revealInFinder');
      default:
        return t('contextMenu.openContainingFolder');
    }
  };

  const positionMenu = () => {
    const menuWidth = 220;
    const menuHeight = 400;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    let left = x;
    let top = y;

    // Adjust if menu would go off screen
    if (left + menuWidth > screenWidth) {
      left = screenWidth - menuWidth - 10;
    }
    if (top + menuHeight > screenHeight) {
      top = screenHeight - menuHeight - 10;
    }

    return { left, top };
  };

  const pos = positionMenu();

  return (
    <div
      ref={menuRef}
      className="fixed bg-gray-800 border border-gray-700 rounded shadow-xl z-50 py-1 min-w-48"
      style={{ left: pos.left, top: pos.top }}
    >
      {/* Copy Section */}
      <div className="px-3 py-1 text-xs text-gray-500 uppercase tracking-wider">
        {t('contextMenu.copy')}
      </div>
      <MenuItem icon={<Copy size={14} />} label={t('contextMenu.copyPath')} onClick={handleCopyPath} />
      <MenuItem icon={<Copy size={14} />} label={t('contextMenu.copyRelativePath')} onClick={handleCopyRelativePath} />
      <MenuItem icon={<FileText size={14} />} label={t('contextMenu.copyName')} onClick={handleCopyName} />

      <div className="my-1 border-t border-gray-700" />

      {/* External Applications Section */}
      <div className="px-3 py-1 text-xs text-gray-500 uppercase tracking-wider">
        {t('contextMenu.external')}
      </div>
      <MenuItem icon={<Terminal size={14} />} label={t('contextMenu.openInTerminal')} onClick={handleOpenInTerminal} />
      <MenuItem icon={<ExternalLink size={14} />} label={getRevealLabel()} onClick={handleRevealInFileManager} />

      <div className="my-1 border-t border-gray-700" />

      {/* Create Section */}
      <div className="px-3 py-1 text-xs text-gray-500 uppercase tracking-wider">
        {t('contextMenu.new')}
      </div>
      <MenuItem icon={<FilePlus size={14} />} label={t('contextMenu.newFile')} onClick={handleNewFile} />
      <MenuItem icon={<FolderPlus size={14} />} label={t('contextMenu.newFolder')} onClick={handleNewFolder} />

      <div className="my-1 border-t border-gray-700" />

      {/* File Operations Section */}
      <MenuItem icon={<Edit3 size={14} />} label={t('common.rename')} onClick={handleRename} />
      <MenuItem icon={<RefreshCw size={14} />} label={t('contextMenu.refresh')} onClick={handleRefresh} />

      <div className="my-1 border-t border-gray-700" />

      {/* Delete Section */}
      <MenuItem
        icon={<Trash2 size={14} />}
        label={t('common.delete')}
        onClick={handleDelete}
        className="text-red-400 hover:bg-red-900/20 hover:text-red-300"
      />
    </div>
  );
};

interface MenuItemProps {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
  shortcut?: string;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, onClick, className = '', shortcut }) => {
  return (
    <div
      className={`px-3 py-1.5 text-sm flex items-center justify-between cursor-pointer text-gray-300 hover:bg-gray-700 hover:text-white ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {icon && <span className="text-gray-400">{icon}</span>}
        <span>{label}</span>
      </div>
      {shortcut && <span className="text-xs text-gray-500">{shortcut}</span>}
    </div>
  );
};
