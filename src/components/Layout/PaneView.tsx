import React from 'react';
import { MonacoEditor } from '../Editor/MonacoEditor';
import { Pane, useLayoutStore } from '../../stores/layoutStore';
import { useTranslation } from 'react-i18next';

interface PaneViewProps {
  pane: Pane;
  isActive: boolean;
  splitDirection: 'horizontal' | 'vertical';
  onClick: () => void;
  index: number;
}

export const PaneView: React.FC<PaneViewProps> = ({
  pane,
  isActive,
  splitDirection,
  onClick,
  index,
}) => {
  const { t } = useTranslation();
  const { splitPane, closePane } = useLayoutStore();

  const paneStyle: React.CSSProperties = {
    width: splitDirection === 'horizontal' ? `${pane.size}%` : '100%',
    height: splitDirection === 'vertical' ? `${pane.size}%` : '100%',
    display: 'flex',
    flexDirection: 'column',
    border: isActive ? '2px solid #60a5fa' : '1px solid #374151',
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // allow clicking on header/border to activate pane
    onClick();
  };

  return (
    <div
      className={`pane-container ${isActive ? 'active' : ''}`}
      style={paneStyle}
      onMouseDown={handleMouseDown}
    >
      {/* 窗格头部 */}
      <div className="pane-header bg-[#252526] px-2 py-1 flex items-center justify-between border-b border-gray-700 select-none">
        <div className="pane-title text-xs text-gray-400 truncate">
          {pane.fileId ? `File ${index + 1}` : t('common.emptyPane')}
        </div>
        <div className="pane-actions flex gap-1">
          <button
            className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            onClick={(e) => {
              e.stopPropagation();
              splitPane('horizontal', pane.id);
            }}
            title={t('editor.splitPane')}
          >
            ⊕
          </button>
          {index > 0 && (
            <button
              className="px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded"
              onClick={(e) => {
                e.stopPropagation();
                closePane(pane.id);
              }}
              title={t('editor.closePane')}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 编辑器区域 */}
      <div className="pane-editor flex-1 relative">
        <MonacoEditor paneId={pane.id} />
      </div>
    </div>
  );
};
