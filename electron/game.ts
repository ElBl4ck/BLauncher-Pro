import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import type { Account } from 'eml-lib';
import { obtenerMinecraft } from './auth/msAuth';
import { API_URL, GAME_DIR, GAME_ID } from './config';
import type { GameProgress, GameResult, SyncResult } from './types';

// eml-lib es ESM puro y este proceso se compila a CommonJS. TypeScript convertiría un
// import() normal en require(), así que hacemos un import() "real" con new Function.
type EmlModule = typeof import('eml-lib');
const importarEml = new Function('especificador', 'return import(especificador)') as (
  especificador: string,
) => Promise<EmlModule>;

const LOADERS = ['fabric', 'forge', 'neoforge', 'quilt'] as const;
type LoaderType = (typeof LOADERS)[number];

interface ConfigJuego {
  minecraft: string;
  loader: { type: LoaderType; version: string };
  ram: { minMb: number; recommendedMb: number };
}

const MC_VERSION_RE = /^\d+\.\d+(\.\d+)?$/;
const LOADER_VERSION_RE = /^\d+(\.\d+){1,3}$/;

// ---------- Configuración remota ----------

// Pedimos la versión y el loader a la API y validamos todo: nunca confiamos ciegamente en ella
async function pedirConfig(): Promise<ConfigJuego> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/config`, { signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new Error('No se pudo conectar con el servidor del launcher.');
  }
  if (!res.ok) throw new Error(`El servidor del launcher respondió con error ${res.status}.`);

  const c = (await res.json()) as Partial<ConfigJuego> | null;
  const loader = c?.loader;
  const ram = c?.ram;
  const valida =
    typeof c?.minecraft === 'string' &&
    MC_VERSION_RE.test(c.minecraft) &&
    !!loader &&
    (LOADERS as readonly string[]).includes(loader.type) &&
    typeof loader.version === 'string' &&
    LOADER_VERSION_RE.test(loader.version) &&
    !!ram &&
    Number.isInteger(ram.minMb) &&
    Number.isInteger(ram.recommendedMb) &&
    ram.minMb > 0 &&
    ram.recommendedMb >= ram.minMb;
  if (!valida) throw new Error('La configuración remota del juego es inválida.');
  return c as ConfigJuego;
}

// RAM recomendada por tu API, pero nunca más del 60 % de la memoria del equipo
function calcularMemoria(ram: ConfigJuego['ram']) {
  const totalMb = Math.floor(os.totalmem() / 1024 / 1024);
  const max = Math.max(1024, Math.min(ram.recommendedMb, Math.floor(totalMb * 0.6)));
  return { min: Math.min(1024, Math.floor(max / 2)), max };
}

// ---------- Cuenta ----------

type SesionMinecraft = Awaited<ReturnType<typeof obtenerMinecraft>>;

// Convierte nuestra sesión de msmc al formato de cuenta que espera EML Lib
function crearCuenta(mc: SesionMinecraft): Account {
  const perfil = mc.profile;
  if (!perfil) throw new Error('La cuenta no tiene un perfil de Minecraft.');
  return {
    name: perfil.name,
    uuid: perfil.id,
    accessToken: mc.mcToken,
    clientToken: randomUUID(),
    meta: { online: true, type: 'msa' },
    // EML solo usa xbox.xuid; el resto de campos existe para cumplir el tipo
    xbox: { xuid: mc.xuid, gamertag: perfil.name, ageGroup: '' },
  };
}

function mensajeError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code;
  switch (code) {
    case 'FETCH_ERROR':
    case 'NET_ERROR':
    case 'TOO_MANY_REQUESTS':
      return 'No se pudo descargar la información del juego. Revisa tu conexión e inténtalo de nuevo.';
    case 'DOWNLOAD_ERROR':
    case 'HASH_ERROR':
      return 'Falló la descarga de un archivo del juego. Inténtalo de nuevo.';
    case 'JAVA_ERROR':
      return 'No se pudo preparar Java para el juego.';
    case 'FILE_ERROR':
      return 'No se pudo escribir en la carpeta del juego. Cierra Minecraft e inténtalo de nuevo.';
    case 'EXEC_ERROR':
      return 'No se pudo iniciar Minecraft.';
    default:
      // Los errores propios (sin code) ya están redactados en español
      return err instanceof Error && !code ? err.message : 'Ocurrió un error inesperado al preparar el juego.';
  }
}

// ---------- Lanzamiento ----------

let jugando: Promise<GameResult> | null = null;

// Evita lanzar dos instancias del juego (doble clic)
export function jugar(
  sync: () => Promise<SyncResult>,
  onProgress: (p: GameProgress) => void,
): Promise<GameResult> {
  return (jugando ??= ejecutar(sync, onProgress).finally(() => {
    jugando = null;
  }));
}

async function ejecutar(
  sync: () => Promise<SyncResult>,
  onProgress: (p: GameProgress) => void,
): Promise<GameResult> {
  try {
    // 1) Mods al día justo antes de arrancar (el launcher pudo quedar abierto horas)
    const mods = await sync();
    if (!mods.ok) return { ok: false, error: mods.error ?? 'No se pudieron actualizar los mods.' };

    // 2) Configuración y sesión (obtenerMinecraft renueva el token si caducó)
    const config = await pedirConfig();
    const cuenta = crearCuenta(await obtenerMinecraft());

    // 3) Motor de lanzamiento
    const { Launcher } = await importarEml('eml-lib');
    const launcher = new Launcher({
      root: GAME_ID,
      account: cuenta,
      minecraft: {
        version: config.minecraft,
        loader: { loader: config.loader.type, version: config.loader.version },
      },
      // Si estuviera activa, EML borraría todo lo que no esté en su manifiesto, incluidos nuestros mods
      cleaning: { enabled: false },
      java: { install: 'auto' }, // descarga la versión de Java que pida esta versión de Minecraft
      memory: calcularMemoria(config.ram),
      window: { width: 1280, height: 720 },
      // Sin argumentos extra: el juego abre en el menú principal (conexión directa desactivada)
    });

    // La carpeta que usa EML debe ser donde sincronizamos los mods; si no, el juego arrancaría sin ellos
    if (path.resolve(launcher.config.root) !== path.resolve(GAME_DIR)) {
      throw new Error('La carpeta del juego no coincide con la de los mods.');
    }

    // 4) Eventos → progreso
    let totalBytes = 0;
    let completados = 0; // bytes de los grupos de archivos ya terminados
    let porcentaje = 0;
    let ultimoEnvio = 0;
    const lineas: string[] = []; // últimas líneas del juego, solo para diagnosticar un fallo
    let codigoSalida: number | null = null;
    let fallo = false;

    const emitir = (phase: GameProgress['phase'], message: string, extra: Partial<GameProgress> = {}) =>
      onProgress({ phase, message, percent: porcentaje, ...extra });

    launcher.on('launch_compute_download', () => emitir('preparing', 'Comprobando archivos del juego…'));
    launcher.on('launch_download', (d) => {
      totalBytes = d.total.size;
    });
    // EML descarga por grupos (Java, librerías, assets…) y reinicia el contador en cada uno
    launcher.on('download_progress', (d) => {
      const ahora = Date.now();
      if (!totalBytes || ahora - ultimoEnvio < 100) return; // máx. 10 avisos por segundo
      ultimoEnvio = ahora;
      porcentaje = Math.min(99, Math.round(((completados + d.downloaded.size) / totalBytes) * 100));
      emitir('downloading', 'Descargando el juego…', { speedBps: d.speed });
    });
    launcher.on('download_end', (d) => {
      completados += d.downloaded.size;
    });
    launcher.on('download_error', (d) => console.error('[game] descarga fallida:', d.filename, d.message));
    launcher.on('launch_install_loader', () => emitir('installing', `Instalando ${config.loader.type}…`));
    launcher.on('launch_extract_natives', () => emitir('installing', 'Preparando archivos…'));
    launcher.on('launch_copy_assets', () => emitir('installing', 'Preparando archivos…'));
    launcher.on('launch_patch_loader', () => emitir('installing', 'Preparando archivos…'));
    launcher.on('launch_check_java', () => emitir('starting', 'Comprobando Java…'));
    launcher.on('launch_launch', () => {
      porcentaje = 100;
      emitir('running', 'Minecraft en ejecución');
    });
    launcher.on('launch_data', (linea) => {
      lineas.push(linea);
      if (lineas.length > 200) lineas.shift();
    });
    launcher.on('launch_close', (codigo) => {
      codigoSalida = codigo;
    });
    launcher.on('launch_crash', () => {
      fallo = true;
    });

    // 5) launch() no termina hasta que el jugador cierra el juego
    await launcher.launch();

    if (fallo) {
      console.error(`[game] Minecraft terminó con código ${codigoSalida}. Últimas líneas:\n${lineas.slice(-40).join('\n')}`);
      return { ok: false, crashed: true, exitCode: codigoSalida, error: 'Minecraft se cerró de forma inesperada.' };
    }
    return { ok: true, exitCode: codigoSalida };
  } catch (err) {
    console.error('[game]', err);
    return { ok: false, error: mensajeError(err) };
  }
}