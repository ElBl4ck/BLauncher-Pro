import { useCallback, useEffect, useState } from 'react';
import type { SyncProgress, SyncResult } from '../../electron/types';

export function useModSync() {
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Nos suscribimos al progreso mientras el componente esté montado
  useEffect(() => window.launcherAPI.onModsProgress(setProgress), []);

  const sync = useCallback(async () => {
    setSyncing(true);
    setResult(null);
    setResult(await window.launcherAPI.syncMods());
    setSyncing(false);
  }, []);

  return { progress, result, syncing, sync };
}