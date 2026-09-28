import { app } from 'electron';
import path from 'node:path';

// URL de la API. En desarrollo apunta a tu backend local.
// (En el paso de empaquetado la fijamos a tu dominio real con HTTPS)
export const API_URL = process.env.LAUNCHER_API_URL ?? 'http://localhost:3001';

// Carpeta propia del launcher, aislada de cualquier .minecraft existente
export const GAME_DIR = path.join(app.getPath('userData'), 'game');
export const MODS_DIR = path.join(GAME_DIR, 'mods');
export const MANIFEST_PATH = path.join(GAME_DIR, 'mods-manifest.json');

export const MS_CLIENT_ID = process.env.MS_CLIENT_ID ?? '3c445ce6-fa2d-4d91-af4a-ac11f2ea968e';
export const MS_REDIRECT_URI = 'http://localhost/';