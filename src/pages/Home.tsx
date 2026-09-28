import { useEffect } from 'react';
import { useModSync } from '../hooks/useModSync';

const mb = (bytes = 0) => (bytes / 1024 / 1024).toFixed(1);

export default function Home() {
  const { progress, result, syncing, sync } = useModSync();

  // Al abrir el launcher, sincronizamos automáticamente
  useEffect(() => {
    sync();
  }, [sync]);

  const percent = result?.ok ? 100 : progress?.percent ?? 0;
  const listo = result?.ok === true;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">Mi Servidor</h1>

      <div className="w-full max-w-md">
        <div className="h-3 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-violet-500 transition-all duration-200"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          {result?.error ?? progress?.message ?? 'Iniciando…'}
          {progress?.phase === 'downloading' && progress.totalBytes
            ? ` (${mb(progress.receivedBytes)} / ${mb(progress.totalBytes)} MB · ${progress.fileIndex}/${progress.totalFiles})`
            : ''}
        </p>
      </div>

      {result && !result.ok && (
        <button onClick={sync} className="rounded-lg bg-zinc-800 px-4 py-2 hover:bg-zinc-700">
          Reintentar
        </button>
      )}

      <button
        disabled={!listo || syncing}
        title="Se activa en un paso posterior"
        className="rounded-xl bg-violet-600 px-10 py-3 text-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        JUGAR
      </button>
    </div>
  );
}