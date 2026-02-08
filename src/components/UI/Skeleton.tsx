import React from 'react';
import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className, 
  variant = 'rectangular', 
  width, 
  height 
}) => {
  return (
    <div 
      className={clsx(
        "animate-pulse bg-[#2a2d2e] rounded",
        variant === 'circular' && "rounded-full",
        variant === 'text' && "h-4 w-full mb-2",
        className
      )}
      style={{ width, height }}
    />
  );
};

// 预定义占位符：消息气泡
export const MessageSkeleton = () => (
  <div className="flex flex-col gap-3 p-4">
    <div className="flex items-center gap-3">
      <Skeleton variant="circular" width={32} height={32} />
      <Skeleton width={120} height={16} />
    </div>
    <div className="space-y-2">
      <Skeleton width="90%" />
      <Skeleton width="75%" />
      <Skeleton width="40%" />
    </div>
  </div>
);

// 预定义占位符：模态框
export const ModalSkeleton = () => (
  <div className="fixed inset-0 z-[300] flex items-center justify-center pointer-events-none">
    <div className="bg-[#252526] w-[700px] h-[500px] rounded-lg border border-gray-700 p-6 flex flex-col gap-6 shadow-2xl">
      <div className="flex justify-between items-center">
        <Skeleton width={200} height={24} />
        <Skeleton width={24} height={24} />
      </div>
      <div className="flex-1 flex gap-6">
        <div className="w-48 space-y-2 border-r border-gray-700 pr-4">
          <Skeleton height={32} />
          <Skeleton height={32} />
          <Skeleton height={32} />
          <Skeleton height={32} />
          <Skeleton height={32} />
        </div>
        <div className="flex-1 space-y-4">
          <Skeleton height={100} />
          <Skeleton height={200} />
        </div>
      </div>
    </div>
  </div>
);
