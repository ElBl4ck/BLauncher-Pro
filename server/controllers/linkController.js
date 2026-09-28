import { randomBytes } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLAYERS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data/players.json');

const DESAFIO_TTL_MS = 60_000; // el desafío caduca en 1 minuto
const MAX_DESAFIOS = 5_000; // tope para que nadie llene la memoria pidiendo desafíos
const desafios = new Map(); // serverId -> instante de expiración

function limpiarDesafios() {
  const ahora = Date.now();
  for (const [id, expira] of desafios) if (expira < ahora) desafios.delete(id);
}

// POST /api/link/challenge
export function crearDesafio(_req, res) {
  limpiarDesafios();
  if (desafios.size >= MAX_DESAFIOS) {
    return res.status(429).json({ error: 'Demasiadas solicitudes, inténtalo en un minuto' });
  }
  const serverId = randomBytes(16).toString('hex'); // 32 caracteres hexadecimales
  desafios.set(serverId, Date.now() + DESAFIO_TTL_MS);
  res.json({ serverId, expiresInMs: DESAFIO_TTL_MS });
}

// ---------- Persistencia (archivo JSON) ----------

async function leerJugadores() {
  try {
    return JSON.parse(await readFile(PLAYERS_FILE, 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {}; // primera vez
    throw err; // si el JSON está dañado NO lo sobrescribimos
  }
}

// Cola de escrituras: dos vinculaciones simultáneas no se pisan
let cola = Promise.resolve();
function guardarJugador(uuid, nombre) {
  const tarea = cola.catch(() => {}).then(async () => {
    const jugadores = await leerJugadores();
    const ahora = new Date().toISOString();
    jugadores[uuid] = { uuid, name: nombre, linkedAt: jugadores[uuid]?.linkedAt ?? ahora, lastSeen: ahora };
    const tmp = `${PLAYERS_FILE}.tmp`;
    await writeFile(tmp, JSON.stringify(jugadores, null, 2));
    await rename(tmp, PLAYERS_FILE); // escritura atómica
  });
  cola = tarea;
  return tarea;
}

// POST /api/link  { username, serverId }
export async function vincular(req, res) {
  const { username, serverId } = req.body ?? {};
  if (
    typeof username !== 'string' || !/^[A-Za-z0-9_]{3,16}$/.test(username) ||
    typeof serverId !== 'string' || !/^[a-f0-9]{32}$/.test(serverId)
  ) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }

  // El desafío debe existir y no haber caducado. Se consume: solo sirve una vez.
  const expira = desafios.get(serverId);
  desafios.delete(serverId);
  if (!expira || expira < Date.now()) {
    return res.status(400).json({ error: 'Desafío inválido o caducado' });
  }

  try {
    // Le preguntamos a Mojang quién se unió con este serverId
    const url = new URL('https://sessionserver.mojang.com/session/minecraft/hasJoined');
    url.searchParams.set('username', username);
    url.searchParams.set('serverId', serverId);
    const r = await fetch(url, { signal: AbortSignal.timeout(8_000) });

    if (r.status === 204) return res.status(401).json({ error: 'No se pudo verificar la cuenta de Minecraft' });
    if (!r.ok) throw new Error(`Mojang respondió ${r.status}`);

    const perfil = await r.json();
    if (typeof perfil?.id !== 'string' || !/^[a-f0-9]{32}$/i.test(perfil.id) || typeof perfil.name !== 'string') {
      throw new Error('Respuesta inesperada de Mojang');
    }

    const uuid = perfil.id.toLowerCase();
    await guardarJugador(uuid, perfil.name); // el UUID viene de MOJANG, no del launcher
    res.json({ ok: true, uuid, name: perfil.name });
  } catch (err) {
    console.error('[link]', err);
    res.status(502).json({ error: 'No se pudo contactar con Mojang' });
  }
}