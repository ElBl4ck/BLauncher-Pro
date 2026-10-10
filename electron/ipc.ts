import { ipcMain, type WebContents } from 'electron';
import { GAME_DIR } from './config';
import { haySesion, login, logout, reintentarVinculacion, restaurarSesion } from './auth/msAuth';
import { jugar } from './game';
import { syncMods } from './modSync';
import type { GameResult, SyncResult } from './types';

// Devuelve la misma promesa mientras la operación siga en curso
// (evita dobles clics y el doble montaje de React StrictMode en desarrollo)
function unico<T>(fn: () => Promise<T>): () => Promise<T> {
  let enCurso: Promise<T> | null = null;
  return () => (enCurso ??= fn().finally(() => { enCurso = null; }));
}

let syncEnCurso: Promise<SyncResult> | null = null;

// Una sola sincronización a la vez, la pida quien la pida (arranque automático o botón JUGAR).
// El main NO confía en que React "ya verificó" el login: lo comprueba él.
function sincronizar(wc: WebContents): Promise<SyncResult> {
  if (!haySesion()) {
    return Promise.resolve({ ok: false, downloaded: 0, removed: 0, upToDate: 0, error: 'Inicia sesión para continuar.' });
  }
  return (syncEnCurso ??= syncMods((p) => {
    if (!wc.isDestroyed()) wc.send('mods:progress', p);
  }).finally(() => {
    syncEnCurso = null;
  }));
}

export function registerIpc() {
  console.log('[launcher] carpeta del juego:', GAME_DIR);

  ipcMain.handle('auth:restore', unico(restaurarSesion));
  ipcMain.handle('auth:login', unico(login));
  ipcMain.handle('auth:relink', unico(reintentarVinculacion));
  ipcMain.handle('auth:logout', () => logout());

  ipcMain.handle('mods:sync', (event) => sincronizar(event.sender));

  ipcMain.handle('game:play', (event): Promise<GameResult> | GameResult => {
    if (!haySesion()) return { ok: false, error: 'Inicia sesión para jugar.' };
    const wc = event.sender;
    return jugar(
      () => sincronizar(wc),
      (p) => {
        if (!wc.isDestroyed()) wc.send('game:progress', p);
      },
    );
  });
}