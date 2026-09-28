import { ipcMain } from 'electron';
import { GAME_DIR } from './config';
import { haySesion, login, logout, reintentarVinculacion, restaurarSesion } from './auth/msAuth';
import { syncMods } from './modSync';
import type { SyncResult } from './types';

// Devuelve la misma promesa mientras la operación siga en curso
// (evita dobles clics y el doble montaje de React StrictMode en desarrollo)
function unico<T>(fn: () => Promise<T>): () => Promise<T> {
  let enCurso: Promise<T> | null = null;
  return () => (enCurso ??= fn().finally(() => { enCurso = null; }));
}

let syncEnCurso: Promise<SyncResult> | null = null;

export function registerIpc() {
  console.log('[launcher] carpeta del juego:', GAME_DIR);

  ipcMain.handle('auth:restore', unico(restaurarSesion));
  ipcMain.handle('auth:login', unico(login));
  ipcMain.handle('auth:relink', unico(reintentarVinculacion));
  ipcMain.handle('auth:logout', () => logout());

  ipcMain.handle('mods:sync', (event) => {
    // El main NO confía en que React "ya verificó" el login: lo comprueba él
    if (!haySesion()) {
      const sinSesion: SyncResult = { ok: false, downloaded: 0, removed: 0, upToDate: 0, error: 'Inicia sesión para continuar.' };
      return sinSesion;
    }
    if (syncEnCurso) return syncEnCurso;
    syncEnCurso = syncMods((progress) => {
      if (!event.sender.isDestroyed()) event.sender.send('mods:progress', progress);
    }).finally(() => {
      syncEnCurso = null;
    });
    return syncEnCurso;
  });
}