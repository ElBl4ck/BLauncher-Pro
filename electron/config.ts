import { app } from 'electron';
import path from 'node:path';

// URL de la API. En desarrollo apunta a tu backend local.
// (En el paso de empaquetado la fijamos a tu dominio real con HTTPS)
export const API_URL = process.env.LAUNCHER_API_URL ?? 'http://localhost:3001';

// Carpeta propia del launcher, aislada de cualquier .minecraft existente

export const GAME_ID = 'blauncher';

function carpetaDelJuego(): string {
  const base =
    process.platform === 'win32'
      ? process.env.APPDATA ?? ''
      : process.platform === 'darwin'
        ? path.join(process.env.HOME ?? '', 'Library', 'Application Support')
        : process.env.HOME ?? '';
  const id = GAME_ID.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  return path.join(base, process.platform === 'darwin' ? id : `.${id}`);
}

export const GAME_DIR = carpetaDelJuego();
export const MODS_DIR = path.join(GAME_DIR, 'mods');
export const MANIFEST_PATH = path.join(GAME_DIR, 'mods-manifest.json');

export const MS_CLIENT_ID = process.env.MS_CLIENT_ID ?? '3c445ce6-fa2d-4d91-af4a-ac11f2ea968e';
export const MS_REDIRECT_URI = 'http://localhost/';