import { contextBridge, ipcRenderer } from 'electron';
import type { SyncProgress } from './types';

// Único puente entre React y Electron. Solo exponemos funciones concretas,
// nunca ipcRenderer completo.
contextBridge.exposeInMainWorld('launcherAPI', {
  syncMods: () => ipcRenderer.invoke('mods:sync'),
  authRestore: () => ipcRenderer.invoke('auth:restore'),
  authLogin: () => ipcRenderer.invoke('auth:login'),
  authLogout: () => ipcRenderer.invoke('auth:logout'),
  authRelink: () => ipcRenderer.invoke('auth:relink'),

  // Suscripción al progreso; devuelve una función para cancelar la suscripción
  onModsProgress: (callback: (p: SyncProgress) => void) => {
    const listener = (_e: unknown, data: SyncProgress) => callback(data);
    ipcRenderer.on('mods:progress', listener);
    return () => ipcRenderer.removeListener('mods:progress', listener);
  },
});