/**
 * Data Management Panel
 *
 * Provides thread data export/import functionality
 */

import React, { useState, useRef } from 'react';
import { Download, Upload, Trash2, RefreshCw } from 'lucide-react';
import { useThreadStore } from '../../stores/threadStore';
import { exportThreadsToFile, importThreadsFromFile } from '../../stores/persistence/threadPersistence';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export const DataManagementPanel: React.FC = () => {
  const { t } = useTranslation();
  const threadStore = useThreadStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Get thread statistics
  const threads = Object.values(threadStore.threads);
  const activeThreads = threads.filter(t => t.status === 'active').length;
  const archivedThreads = threads.filter(t => t.status === 'archived').length;
  const totalMessages = threads.reduce((sum, t) => sum + t.messageCount, 0);

  // Export all threads to JSON file
  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportThreadsToFile();
      toast.success('导出成功', {
        description: '对话数据已成功导出到文件',
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('导出失败', {
        description: error instanceof Error ? error.message : '未知错误',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Import threads from JSON file
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      await importThreadsFromFile(file);
      toast.success('导入成功', {
        description: '对话数据已成功导入',
      });
      // Refresh the page to reload data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Import failed:', error);
      toast.error('导入失败', {
        description: error instanceof Error ? error.message : '文件格式错误或数据损坏',
      });
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Clear all deleted threads
  const handleClearDeleted = async () => {
    setIsClearing(true);
    try {
      threadStore.clearDeletedThreads();
      toast.success('清理完成', {
        description: '已删除的对话已被永久清除',
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="bg-[#1e1e1e] rounded-lg p-4 border border-gray-700">
        <h3 className="text-sm font-medium text-gray-300 mb-3">数据统计</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{activeThreads}</div>
            <div className="text-xs text-gray-500 mt-1">活跃对话</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{archivedThreads}</div>
            <div className="text-xs text-gray-500 mt-1">已归档</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{totalMessages}</div>
            <div className="text-xs text-gray-500 mt-1">总消息数</div>
          </div>
        </div>
      </div>

      {/* Export / Import */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-300">导出/导入</h3>
        <p className="text-xs text-gray-500">
          导出可将所有对话数据保存为 JSON 文件，用于备份或迁移。导入可从备份文件恢复对话。
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={isExporting || activeThreads === 0}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${isExporting || activeThreads === 0
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
              }
            `}
          >
            <Download size={16} />
            {isExporting ? '导出中...' : '导出对话'}
          </button>

          <button
            onClick={handleImportClick}
            disabled={isImporting}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${isImporting
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
              }
            `}
          >
            <Upload size={16} />
            {isImporting ? '导入中...' : '导入对话'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Storage Management */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-300">存储管理</h3>
        <p className="text-xs text-gray-500">
          删除的对话会被标记为已删除但仍占用存储空间。您可以永久清除这些对话。
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleClearDeleted}
            disabled={isClearing}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${isClearing
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white'
              }
            `}
          >
            <Trash2 size={16} />
            {isClearing ? '清理中...' : '清除已删除对话'}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
        <div className="flex gap-2">
          <RefreshCw size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-200">
            <strong className="block mb-1">自动保存</strong>
            对话数据会自动保存到浏览器存储中。即使关闭浏览器，您的对话也会被保留。
          </div>
        </div>
      </div>
    </div>
  );
};
