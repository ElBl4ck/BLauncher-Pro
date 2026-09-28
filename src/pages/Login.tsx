interface Props {
  onLogin: () => void;
  entrando: boolean;
  error: string | null;
}

export default function Login({ onLogin, entrando, error }: Props) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">Mi Servidor</h1>
      <p className="max-w-sm text-center text-zinc-400">
        Inicia sesión con la cuenta de Microsoft que tiene Minecraft: Java Edition.
      </p>
      <button
        onClick={onLogin}
        disabled={entrando}
        className="rounded-xl bg-violet-600 px-8 py-3 font-semibold transition hover:bg-violet-500 disabled:opacity-50"
      >
        {entrando ? 'Esperando a Microsoft…' : 'Iniciar sesión con Microsoft'}
      </button>
      {error && <p className="max-w-sm text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}