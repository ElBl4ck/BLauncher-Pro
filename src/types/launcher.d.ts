import type { AuthResult, SyncProgress, SyncResult } from '../../electron/types';

declare global {
  interface Window {
    launcherAPI: {
      syncMods: () => Promise<SyncResult>;
      onModsProgress: (callback: (p: SyncProgress) => void) => () => void;
      authRestore: () => Promise<AuthResult>;
      authLogin: () => Promise<AuthResult>;
      authLogout: () => Promise<void>;
      authRelink: () => Promise<AuthResult>;
    };
  }
}

export {};