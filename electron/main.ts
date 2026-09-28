import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { registerIpc } from './ipc';

// URL del servidor de desarrollo de Vite (solo se usa en modo dev)
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    // Fondo oscuro por defecto mientras carga (evita flash blanco)
    backgroundColor: '#0f0f10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // seguridad: aislar el contexto del renderer
      nodeIntegration: false, // el renderer NUNCA debe tener acceso directo a Node
    },
  });

  if (VITE_DEV_SERVER_URL) {
    // Modo desarrollo: cargamos el servidor de Vite
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // Modo producción: cargamos el build estático de React
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Solo permitimos una instancia del launcher a la vez
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  // Ya hay otra abierta: esta se cierra sola
  app.quit();
} else {
  // Si el usuario intenta abrir una segunda vez, traemos la primera al frente
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // Único punto de arranque de la app
  app.whenReady().then(() => {
    registerIpc(); // registramos los canales IPC antes de abrir la ventana
    createWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}