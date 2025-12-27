import React, { useEffect, useRef, useState } from 'react';
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
  X,
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

interface InputDialogProps {
  title: string;
  defaultValue: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

const InputDialog: React.FC<InputDialogProps> = ({ title, defaultValue, onConfirm, onCancel }) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus and select all text when dialog opens
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={onCancel}>
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-6 min-w-96" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={title}
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              OK
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

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
  const [inputDialog, setInputDialog] = useState<{
    title: string;
    defaultValue: string;
    onConfirm: (value: string) => void;
  } | null>(null);

  // Close menu on click outside (but not when input dialog is open)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close if input dialog is open
      if (inputDialog) return;

      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, inputDialog]);

  // Close menu on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (inputDialog) {
          setInputDialog(null);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, inputDialog]);

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

  const handleNewFile = () => {
    setInputDialog({
      title: t('common.enterFileName'),
      defaultValue: '',
      onConfirm: async (name) => {
        try {
          const dirPath = node.kind === 'directory' ? node.path : node.path.substring(0, node.path.lastIndexOf('/'));
          const newPath = `${dirPath}/${dirPath.endsWith('/') ? '' : '/'}${name}`;
          console.log('[ContextMenu] Creating new file:', newPath);
          await createFile(newPath);
          toast.success(t('common.fileCreated'));
          console.log('[ContextMenu] File created, refreshing file tree...');
          await onRefresh();
          console.log('[ContextMenu] File tree refreshed');
        } catch (error) {
          console.error('[ContextMenu] Failed to create file:', error);
          toast.error(`${t('common.createFileFailed')}: ${String(error)}`);
        }
        setInputDialog(null);
        onClose();
      }
    });
  };

  const handleNewFolder = () => {
    setInputDialog({
      title: t('common.enterFolderName'),
      defaultValue: '',
      onConfirm: async (name) => {
        try {
          const dirPath = node.kind === 'directory' ? node.path : node.path.substring(0, node.path.lastIndexOf('/'));
          const newPath = `${dirPath}/${dirPath.endsWith('/') ? '' : '/'}${name}`;
          console.log('[ContextMenu] Creating new folder:', newPath);
          await createDirectory(newPath);
          toast.success(t('common.folderCreated'));
          console.log('[ContextMenu] Folder created, refreshing file tree...');
          await onRefresh();
          console.log('[ContextMenu] File tree refreshed');
        } catch (error) {
          console.error('[ContextMenu] Failed to create folder:', error);
          toast.error(`${t('common.createFolderFailed')}: ${String(error)}`);
        }
        setInputDialog(null);
        onClose();
      }
    });
  };

  const handleRename = () => {
    console.log('[ContextMenu] Rename requested for:', node.name, 'at path:', node.path);
    setInputDialog({
      title: t('common.renameTo'),
      defaultValue: node.name,
      onConfirm: async (newName) => {
        console.log('[ContextMenu] User entered new name:', newName);
        if (newName !== node.name) {
          const pathParts = node.path.split('/');
          pathParts.pop();
          const newPath = [...pathParts, newName].join('/');
          console.log('[ContextMenu] Rename path:', node.path, '->', newPath);

          try {
            await renameFile(node.path, newPath);
            console.log('[ContextMenu] Rename successful, refreshing file tree...');
            toast.success(t('common.renamedSuccessfully', { newName }));
            // Wait for refresh to complete before closing
            await onRefresh();
            console.log('[ContextMenu] File tree refreshed');
          } catch (error) {
            console.error('[ContextMenu] Rename failed:', error);
            toast.error(`${t('common.renameFailed')}: ${String(error)}`);
          }
        }
        setInputDialog(null);
        onClose();
      }
    });
  };

  const handleDelete = async () => {
    console.log('[ContextMenu] Delete requested for:', node.name, 'at path:', node.path);
    if (window.confirm(t('common.confirmDeleteFile', { fileName: node.name }))) {
      try {
        await deleteFile(node.path);
        console.log('[ContextMenu] Delete successful, refreshing file tree...');
        toast.success(t('common.deletedSuccessfully'));
        await onRefresh();
        console.log('[ContextMenu] File tree refreshed');
      } catch (error) {
        console.error('[ContextMenu] Delete failed:', error);
        toast.error(`${t('common.deleteFailed')}: ${String(error)}`);
      }
    } else {
      console.log('[ContextMenu] Delete cancelled');
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
    <>
      {inputDialog && (
        <InputDialog
          title={inputDialog.title}
          defaultValue={inputDialog.defaultValue}
          onConfirm={inputDialog.onConfirm}
          onCancel={() => setInputDialog(null)}
        />
      )}
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
    </>
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
