import React from 'react';
import { Circle, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { TaskNode } from '../../stores/pivoStore';
import { clsx } from 'clsx';

interface PivoTreeListProps {
  tasks: TaskNode[];
  level?: number;
}

const TaskItem: React.FC<{ task: TaskNode; level: number }> = ({ task, level }) => {
  const getIcon = () => {
    switch (task.status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'healing':
        return <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />;
      default:
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="flex flex-col">
      <div 
        className={clsx(
          "flex items-center gap-2 py-1 px-2 rounded-md hover:bg-gray-100/50 transition-colors",
          task.status === 'success' && "opacity-60"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        <div className="flex-shrink-0">{getIcon()}</div>
        <span className={clsx(
          "text-sm font-medium truncate",
          task.status === 'success' && "line-through"
        )}>
          {task.label}
        </span>
        <span className="text-[10px] uppercase px-1 rounded bg-gray-100 text-gray-500 ml-auto">
          {task.task_type}
        </span>
      </div>
      {task.children.length > 0 && (
        <div className="flex flex-col">
          {task.children.map((child) => (
            <TaskItem key={child.id} task={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const PivoTreeList: React.FC<PivoTreeListProps> = ({ tasks, level = 0 }) => {
  if (!tasks || tasks.length === 0) return null;

  return (
    <div className="my-2 border border-gray-100 rounded-lg bg-gray-50/30 p-1 space-y-0.5 max-w-full overflow-hidden">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} level={level} />
      ))}
    </div>
  );
};
