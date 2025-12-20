import { useRef, useEffect, useCallback } from 'react';

export type Priority = 'high' | 'normal' | 'low';

interface ScheduledTask {
  id: number;
  callback: (time: number) => void;
  priority: Priority;
}

export class FrameRateScheduler {
  private tasks: ScheduledTask[] = [];
  private nextId = 0;
  private rafId: number | null = null;
  private targetFPS = 60;
  private frameDuration = 1000 / 60;

  constructor(targetFPS = 60) {
    this.setTargetFPS(targetFPS);
  }

  public setTargetFPS(fps: number) {
    this.targetFPS = fps;
    this.frameDuration = 1000 / fps;
  }

  public schedule(callback: (time: number) => void, priority: Priority = 'normal'): number {
    const id = this.nextId++;
    this.tasks.push({ id, callback, priority });
    this.tasks.sort((a, b) => {
      const priorityMap = { high: 0, normal: 1, low: 2 };
      return priorityMap[a.priority] - priorityMap[b.priority];
    });
    
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.run);
    }
    
    return id;
  }

  public cancel(id: number) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    if (this.tasks.length === 0 && this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private run = (time: number) => {
    const startTime = performance.now();
    
    while (this.tasks.length > 0) {
      const task = this.tasks.shift();
      if (task) {
        task.callback(time);
      }
      
      // If we've exceeded half of the frame duration, defer remaining tasks to next frame
      // to avoid frame drops, unless they are high priority
      if (performance.now() - startTime > this.frameDuration / 2) {
        if (this.tasks.length > 0 && this.tasks[0].priority !== 'high') {
          break;
        }
      }
    }
    
    if (this.tasks.length > 0) {
      this.rafId = requestAnimationFrame(this.run);
    } else {
      this.rafId = null;
    }
  };
}

export const useFrameRate = (targetFPS = 60) => {
  const schedulerRef = useRef<FrameRateScheduler | null>(null);

  if (!schedulerRef.current) {
    schedulerRef.current = new FrameRateScheduler(targetFPS);
  }

  useEffect(() => {
    if (schedulerRef.current) {
      schedulerRef.current.setTargetFPS(targetFPS);
    }
  }, [targetFPS]);

  const scheduleTask = useCallback((callback: (time: number) => void, priority: Priority = 'normal') => {
    return schedulerRef.current?.schedule(callback, priority);
  }, []);

  const cancelTask = useCallback((id: number) => {
    schedulerRef.current?.cancel(id);
  }, []);

  return { scheduleTask, cancelTask };
};
