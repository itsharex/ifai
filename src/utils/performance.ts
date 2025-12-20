import { invoke } from "@tauri-apps/api/core";

export type GPUTier = 'high' | 'medium' | 'low' | 'none';

export interface GpuInfo {
  name: string;
  vendor: string;
  memory_total?: number;
}

/**
 * Detects GPU performance tier
 */
export async function detectGPUTier(): Promise<GPUTier> {
  try {
    const gpuInfo = await invoke<GpuInfo>("detect_gpu_info");
    const webglSupport = detectWebGLSupport();
    
    if (!webglSupport) return 'none';
    
    // For now, use a simple heuristic or a more sophisticated one like detect-gpu library logic
    // Since we are in a desktop app, we can also check the GPU name
    const name = gpuInfo.name.toLowerCase();
    
    if (name.includes('nvidia') || name.includes('radeon') || name.includes('apple m')) {
      return 'high';
    }
    
    if (name.includes('intel') || name.includes('graphics')) {
      return 'medium';
    }
    
    return 'low';
  } catch (error) {
    console.error("Failed to detect GPU tier:", error);
    return 'medium'; // Default fallback
  }
}

/**
 * Detects if WebGL is supported
 */
export function detectWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

/**
 * Gets display refresh rate
 */
export async function getDisplayRefreshRate(): Promise<number> {
  try {
    const rate = await invoke<number>("get_display_refresh_rate");
    return rate;
  } catch (error) {
    // Fallback to requestAnimationFrame calculation if Tauri command fails
    return new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      
      function check() {
        frames++;
        const now = performance.now();
        if (now - start >= 1000) {
          resolve(Math.round(frames));
        } else {
          requestAnimationFrame(check);
        }
      }
      
      requestAnimationFrame(check);
    });
  }
}

/**
 * Checks if the system is on battery
 */
export async function isOnBattery(): Promise<boolean> {
  try {
    return await invoke<boolean>("is_on_battery");
  } catch {
    return false;
  }
}

export class PerformanceMonitor {
  private frameTimes: number[] = [];
  private lastFrameTime: number = 0;
  private fps: number = 0;

  constructor() {
    this.lastFrameTime = performance.now();
  }

  public update() {
    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;
    
    if (delta > 0) {
      this.fps = 1000 / delta;
      this.frameTimes.push(delta);
      if (this.frameTimes.length > 60) {
        this.frameTimes.shift();
      }
    }
  }

  public getFPS(): number {
    return Math.round(this.fps);
  }

  public getAverageFPS(): number {
    if (this.frameTimes.length === 0) return 0;
    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    return Math.round(1000 / (sum / this.frameTimes.length));
  }
}
