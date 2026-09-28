import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';
import { app } from 'electron';
import { API_URL, MODS_DIR, MANIFEST_PATH } from './config';
import type { LocalManifest, ModInfo, SyncProgress, SyncResult } from './types';

const FILE_NAME_RE = /^[A-Za-z0-9._+()\-[\] ]+\.jar$/;
const SHA256_RE = /^[a-f0-9]{64}$/i;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Validación de lo que llega de la API ----------

// Nunca confiamos ciegamente en la API: un fileName como "../../algo.exe"
// escribiría fuera de la carpeta de mods (path traversal).
function validateMod(raw: unknown): ModInfo {
  const m = raw as Partial<ModInfo> | null;
  if (
    !m ||
    typeof m.id !== 'string' ||
    typeof m.name !== 'string' ||
    typeof m.version !== 'string' ||
    typeof m.fileName !== 'string' ||
    typeof m.url !== 'string' ||
    typeof m.sha256 !== 'string'
  ) {
    throw new Error('La API devolvió un mod con formato inválido');
  }
  if (!FILE_NAME_RE.test(m.fileName) || m.fileName.includes('..')) {
    throw new Error(`Nombre de archivo no permitido: ${m.fileName}`);
  }
  if (!SHA256_RE.test(m.sha256)) {
    throw new Error(`Hash SHA-256 inválido en ${m.name}`);
  }
  const url = new URL(m.url);
  const esLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  // Solo HTTPS; HTTP únicamente contra localhost y en desarrollo
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && esLocal && !app.isPackaged)) {
    throw new Error(`URL no segura para ${m.name}`);
  }
  return m as ModInfo;
}

async function fetchRemoteMods(): Promise<ModInfo[]> {
  const res = await fetch(`${API_URL}/api/mods`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`La API respondió con error ${res.status}`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error('La API devolvió un formato inesperado');

  const mods = data.map(validateMod);
  const nombres = new Set(mods.map((m) => m.fileName));
  if (nombres.size !== mods.length) throw new Error('La API tiene mods con nombre de archivo repetido');
  return mods;
}

// ---------- Hash y manifiesto local ----------

function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

async function loadManifest(): Promise<LocalManifest> {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, 'utf-8')) as LocalManifest;
  } catch {
    return {}; // primera ejecución o archivo dañado: empezamos de cero
  }
}

async function saveManifest(manifest: LocalManifest): Promise<void> {
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

// Devuelve el hash del archivo local (o null si no existe).
// Si tamaño y fecha coinciden con la caché, no lo recalcula.
async function localHash(fileName: string, manifest: LocalManifest): Promise<string | null> {
  const filePath = path.join(MODS_DIR, fileName);
  let st;
  try {
    st = await stat(filePath);
  } catch {
    return null;
  }
  const cached = manifest[fileName];
  if (cached && cached.size === st.size && cached.mtimeMs === st.mtimeMs) return cached.sha256;

  const sha256 = await hashFile(filePath);
  manifest[fileName] = { sha256, size: st.size, mtimeMs: st.mtimeMs };
  return sha256;
}

// ---------- Descarga ----------

async function downloadMod(
  mod: ModInfo,
  onBytes: (received: number, total: number) => void,
): Promise<void> {
  const dest = path.join(MODS_DIR, mod.fileName);
  const tmp = `${dest}.download`; // se descarga a un temporal y solo se "instala" si el hash coincide

  // Timeout solo para conectar; el cuerpo puede tardar lo que necesite
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(mod.url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok || !res.body) throw new Error(`Descarga fallida (${res.status}) de ${mod.name}`);

  const total = Number(res.headers.get('content-length')) || 0;
  const hash = createHash('sha256');
  let received = 0;
  let lastEmit = 0;

  // Mide bytes y calcula el hash "al vuelo", sin releer el archivo
  const meter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      hash.update(chunk);
      received += chunk.length;
      const now = Date.now();
      if (now - lastEmit >= 100) {
        lastEmit = now;
        onBytes(received, total);
      }
      cb(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(res.body as unknown as WebReadableStream),
      meter,
      createWriteStream(tmp),
    );
  } catch (err) {
    await rm(tmp, { force: true });
    throw err;
  }

  onBytes(received, total);

  if (hash.digest('hex') !== mod.sha256.toLowerCase()) {
    await rm(tmp, { force: true });
    throw new Error(`El archivo de ${mod.name} está corrupto (el hash no coincide)`);
  }
  await rename(tmp, dest); // instalación atómica
}

async function downloadWithRetry(
  mod: ModInfo,
  onBytes: (received: number, total: number) => void,
  attempts = 3,
): Promise<void> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await downloadMod(mod, onBytes);
    } catch (err) {
      lastError = err;
      if (i < attempts) await sleep(1000 * i);
    }
  }
  throw lastError;
}

function friendlyError(err: unknown): string {
  const code = (err as NodeJS.ErrnoException)?.code;
  if (code === 'EBUSY' || code === 'EPERM') return 'Un archivo está en uso. Cierra Minecraft e inténtalo de nuevo.';
  if (err instanceof Error && err.name === 'TimeoutError') return 'No se pudo conectar con el servidor.';
  if (err instanceof TypeError) return 'No se pudo conectar con el servidor.'; // fetch sin red
  return err instanceof Error ? err.message : 'Error desconocido';
}

// ---------- Función pública ----------

export async function syncMods(onProgress: (p: SyncProgress) => void): Promise<SyncResult> {
  const result: SyncResult = { ok: false, downloaded: 0, removed: 0, upToDate: 0 };
  let manifest: LocalManifest = {};

  try {
    await mkdir(MODS_DIR, { recursive: true });
    onProgress({ phase: 'checking', message: 'Buscando actualizaciones…', percent: 0 });

    const remote = await fetchRemoteMods();
    manifest = await loadManifest();

    // 1) ¿Qué falta o cambió?
    const toDownload: ModInfo[] = [];
    for (const mod of remote) {
      const local = await localHash(mod.fileName, manifest);
      if (local === mod.sha256.toLowerCase()) result.upToDate++;
      else toDownload.push(mod);
    }

    // 2) Eliminar lo que ya no está en el backend (solo .jar y restos de descargas)
    const wanted = new Set(remote.map((m) => m.fileName));
    for (const file of await readdir(MODS_DIR)) {
      const gestionable = file.endsWith('.jar') || file.endsWith('.download');
      if (gestionable && !wanted.has(file)) {
        onProgress({ phase: 'removing', message: `Eliminando ${file}`, percent: 0 });
        await rm(path.join(MODS_DIR, file), { force: true });
        delete manifest[file];
        result.removed++;
      }
    }

    // 3) Descargar lo necesario, uno por uno
    for (let i = 0; i < toDownload.length; i++) {
      const mod = toDownload[i];
      const emit = (received: number, total: number) =>
        onProgress({
          phase: 'downloading',
          message: `Descargando ${mod.name}`,
          percent: Math.round(((i + (total ? received / total : 0)) / toDownload.length) * 100),
          currentFile: mod.name,
          fileIndex: i + 1,
          totalFiles: toDownload.length,
          receivedBytes: received,
          totalBytes: total,
        });

      emit(0, 0);
      await downloadWithRetry(mod, emit);

      const st = await stat(path.join(MODS_DIR, mod.fileName));
      manifest[mod.fileName] = { sha256: mod.sha256.toLowerCase(), size: st.size, mtimeMs: st.mtimeMs };
      result.downloaded++;
    }

    result.ok = true;
    onProgress({ phase: 'done', message: 'Todo está al día', percent: 100 });
    return result;
  } catch (err) {
    const message = friendlyError(err);
    console.error('[modSync]', err);
    onProgress({ phase: 'error', message, percent: 0 });
    return { ...result, ok: false, error: message };
  } finally {
    await saveManifest(manifest).catch(() => {}); // guardamos aunque haya fallado a mitad
  }
}