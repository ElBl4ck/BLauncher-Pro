import { useState } from 'react';
import type { AuthSession } from '../../electron/types';

interface Props {
  session: AuthSession;
  onLogout: () => void;
  onRelink: () => void;
}

export default function ProfileCard({ session, onLogout, onRelink }: Props) {
  // El avatar viene de un servicio externo (mc-heads.net). Si falla o es sesión dev, mostramos la inicial.
  const [avatarFalla, setAvatarFalla] = useState(false);

  return (
    <div className="flex items-center gap-3 rounded-xl bg-zinc-900 px-4 py-2" title={session.linkError}>
      {avatarFalla || session.dev ? (
        <div className="grid h-10 w-10 place-items-center rounded bg-zinc-700 font-bold">
          {session.name[0].toUpperCase()}
        </div>
      ) : (
        <img
          src={`https://mc-heads.net/avatar/${session.uuid}/64`}
          alt={session.name}
          className="h-10 w-10 rounded"
          onError={() => setAvatarFalla(true)}
        />
      )}

      <div>
        <p className="font-semibold leading-tight">
          {session.name}
          {session.dev && <span className="ml-2 rounded bg-amber-500/20 px-1.5 text-xs text-amber-400">DEV</span>}
        </p>
        <p className={`text-xs ${session.linked ? 'text-emerald-400' : 'text-amber-400'}`}>
          ● {session.linked ? 'Conectado' : 'Sin vincular'}
        </p>
      </div>

      {!session.linked && (
        <button onClick={onRelink} className="text-sm text-violet-400 hover:underline">Reintentar</button>
      )}
      <button onClick={onLogout} className="ml-2 text-sm text-zinc-400 hover:text-white">Cerrar sesión</button>
    </div>
  );
}