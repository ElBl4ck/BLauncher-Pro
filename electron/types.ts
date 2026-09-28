// Tipos usados por el main process y también por React (import type)

export interface ModInfo {
  id: string;
  name: string;
  version: string;
  fileName: string;
  url: string;
  sha256: string;
}

// Caché local: evita recalcular el hash de cada .jar en cada arranque
export type LocalManifest = Record<string, { sha256: string; size: number; mtimeMs: number }>;

export type SyncPhase = 'checking' | 'downloading' | 'removing' | 'done' | 'error';

export interface SyncProgress {
  phase: SyncPhase;
  message: string;
  percent: number; // progreso global 0-100
  currentFile?: string;
  fileIndex?: number;
  totalFiles?: number;
  receivedBytes?: number;
  totalBytes?: number;
}

export interface SyncResult {
  ok: boolean;
  downloaded: number;
  removed: number;
  upToDate: number;
  error?: string;
}

export interface AuthSession {
  name: string;
  uuid: string; // sin guiones
  linked: boolean; // ¿vinculado en el backend?
  linkError?: string;
  dev?: boolean; // sesión falsa de desarrollo
}

export interface AuthResult {
  ok: boolean;
  session?: AuthSession;
  cancelled?: boolean;
  error?: string;
}