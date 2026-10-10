import type { AuthResult, GameProgress, GameResult, SyncProgress, SyncResult } from '../../electron/types';

declare global {
  interface Window {
    launcherAPI: {
      syncMods: () => Promise<SyncResult>;
      onModsProgress: (callback: (p: SyncProgress) => void) => () => void;
      authRestore: () => Promise<AuthResult>;
      authLogin: () => Promise<AuthResult>;
      authLogout: () => Promise<void>;
      authRelink: () => Promise<AuthResult>;
      gamePlay: () => Promise<GameResult>;
      onGameProgress: (callback: (p: GameProgress) => void) => () => void;
    };
  }
}

export {};