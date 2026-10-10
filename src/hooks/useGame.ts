import { useCallback, useEffect, useState } from 'react';
import type { GameProgress, GameResult } from '../../electron/types';

export function useGame() {
  const [progress, setProgress] = useState<GameProgress | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [playing, setPlaying] = useState(false); // true desde que se pulsa JUGAR hasta que se cierra el juego

  useEffect(() => window.launcherAPI.onGameProgress(setProgress), []);

  const play = useCallback(async () => {
    setPlaying(true);
    setResult(null);
    setProgress(null);
    setResult(await window.launcherAPI.gamePlay());
    setPlaying(false);
  }, []);

  return { progress, result, playing, play };
}