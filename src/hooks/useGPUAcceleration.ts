import { useState, useEffect } from 'react';
import { detectGPUTier, isOnBattery, GPUTier } from '../utils/performance';
import { useSettingsStore } from '../stores/settingsStore';

export interface GPUStatus {
  tier: GPUTier;
  isBattery: boolean;
  isAccelerated: boolean;
  isLoading: boolean;
}

export const useGPUAcceleration = () => {
  const [status, setStatus] = useState<GPUStatus>({
    tier: 'medium',
    isBattery: false,
    isAccelerated: true,
    isLoading: true,
  });

  const { enableGPUAcceleration, performanceMode } = useSettingsStore();

  useEffect(() => {
    let mounted = true;

    async function checkGPU() {
      const tier = await detectGPUTier();
      const isBattery = await isOnBattery();
      
      let isAccelerated = enableGPUAcceleration;
      
      // Auto-downgrade logic
      if (performanceMode === 'auto') {
        if (tier === 'low' || tier === 'none' || isBattery) {
          isAccelerated = false;
        }
      } else if (performanceMode === 'low') {
        isAccelerated = false;
      } else if (performanceMode === 'high') {
        isAccelerated = true;
      }

      if (mounted) {
        setStatus({
          tier,
          isBattery,
          isAccelerated,
          isLoading: false,
        });
      }
    }

    checkGPU();

    return () => {
      mounted = false;
    };
  }, [enableGPUAcceleration, performanceMode]);

  return status;
};
