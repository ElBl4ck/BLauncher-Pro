import { useCallback, useEffect, useState } from 'react';
import type { AuthSession } from '../../electron/types';

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [cargando, setCargando] = useState(true); // intentando restaurar la sesión al abrir
  const [entrando, setEntrando] = useState(false); // ventana de Microsoft abierta
  const [error, setError] = useState<string | null>(null);

  // Al abrir: si hay sesión guardada, entra sin pedir nada
  useEffect(() => {
    let vivo = true;
    window.launcherAPI
      .authRestore()
      .then((r) => { if (vivo && r.ok) setSession(r.session ?? null); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  const login = useCallback(async () => {
    setEntrando(true);
    setError(null);
    const r = await window.launcherAPI.authLogin();
    if (r.ok) setSession(r.session ?? null);
    else if (!r.cancelled) setError(r.error ?? 'No se pudo iniciar sesión.');
    setEntrando(false);
  }, []);

  const logout = useCallback(async () => {
    await window.launcherAPI.authLogout();
    setSession(null);
  }, []);

  const relink = useCallback(async () => {
    const r = await window.launcherAPI.authRelink();
    if (r.ok) setSession(r.session ?? null);
  }, []);

  return { session, cargando, entrando, error, login, logout, relink };
}