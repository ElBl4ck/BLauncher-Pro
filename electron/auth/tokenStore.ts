import { app, safeStorage } from 'electron';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TOKEN_PATH = path.join(app.getPath('userData'), 'session.bin');

// Guardamos el refresh token CIFRADO con el sistema operativo
// (en Windows usa DPAPI: solo este usuario de Windows puede descifrarlo).
export async function guardarToken(token: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) return; // sin cifrado no guardamos nada en disco
  await mkdir(path.dirname(TOKEN_PATH), { recursive: true });
  await writeFile(TOKEN_PATH, safeStorage.encryptString(token));
}

export async function cargarToken(): Promise<string | null> {
  try {
    if (!safeStorage.isEncryptionAvailable()) return null;
    return safeStorage.decryptString(await readFile(TOKEN_PATH));
  } catch {
    return null; // no existe o no se puede descifrar: pedimos login de nuevo
  }
}

export async function borrarToken(): Promise<void> {
  await rm(TOKEN_PATH, { force: true });
}