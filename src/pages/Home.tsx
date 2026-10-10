import { useEffect } from 'react';
import { useGame } from '../hooks/useGame';
import { useModSync } from '../hooks/useModSync';


import logo from '../assets/img/BlLauncher-logo.png';
import playIcon from '../assets/img/play-logo.png';

const mb = (bytes = 0) => (bytes / 1024 / 1024).toFixed(1);

export default function Home() {
  const { progress: modProgress, result: modResult, syncing, sync } = useModSync();
  const { progress: gameProgress, result: gameResult, playing, play } = useGame();

  // Al abrir el launcher, sincronizamos los mods automáticamente
  useEffect(() => {
    sync();
  }, [sync]);

  const modsListos = modResult?.ok === true;
  const enFaseJuego = playing && gameProgress !== null; // ya terminaron los mods, empieza el juego

  // Qué muestra la barra: el progreso del juego tiene prioridad cuando ya empezó
  const percent = enFaseJuego ? gameProgress!.percent : modsListos ? 100 : modProgress?.percent ?? 0;
  const mensaje = enFaseJuego ? gameProgress!.message : modProgress?.message ?? 'Iniciando…';

  const detalleMods =
    !enFaseJuego && modProgress?.phase === 'downloading' && modProgress.totalBytes
      ? ` (${mb(modProgress.receivedBytes)} / ${mb(modProgress.totalBytes)} MB · ${modProgress.fileIndex}/${modProgress.totalFiles})`
      : '';
  const detalleJuego =
    gameProgress?.phase === 'downloading' && gameProgress.speedBps ? ` · ${mb(gameProgress.speedBps)} MB/s` : '';

  // Errores: solo cuando no hay nada en curso
  const error = playing
    ? null
    : gameResult && !gameResult.ok
      ? gameResult.error
      : modResult && !modResult.ok
        ? modResult.error
        : null;

  const textoBoton = !playing ? 'JUGAR' : gameProgress?.phase === 'running' ? 'JUGANDO…' : 'PREPARANDO…';

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <img src={logo} alt="BL Launcher Logo" className="w-[300px] h-auto object-contain"
      />

      <div className="w-full max-w-md">
        <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full bg-violet-500 transition-all duration-200" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          {error ?? `${mensaje}${detalleMods}${detalleJuego}`}
        </p>
      </div>
      <button
        onClick={play}
        disabled={!modsListos || syncing || playing}
        className="relative flex items-center justify-center w-6 bg-zinc-600 hover:bg-zinc-500 text-white font-medium px-4 py-2 rounded-md transition-colors mt-[40px] cursor-pointer"
      >
        <img src={playIcon} alt="Play Icon" className="m-[5px] w-[15px] h-auto" />
        <span className="text-sm font-medium font-bold">{textoBoton}</span>
      </button>

      {modResult && !modResult.ok && !playing && (
        <button onClick={sync} className="rounded-lg bg-zinc-800 px-4 py-4 hover:bg-zinc-700">
          Reintentar
        </button>
      )}

      
    </div>
  );
}