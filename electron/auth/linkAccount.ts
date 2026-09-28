import { API_URL } from '../config';

const MOJANG_JOIN = 'https://sessionserver.mojang.com/session/minecraft/join';
const SERVER_ID_RE = /^[a-f0-9]{32}$/;

// fetch con timeout y un mensaje de error entendible para el jugador
async function pedir(url: string, init: RequestInit, destino: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new Error(`No se pudo conectar con ${destino}.`);
  }
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function vincularCuenta(p: { mcToken: string; uuid: string; name: string }): Promise<void> {
  // 1) Pedimos a NUESTRO backend un desafío aleatorio de un solo uso
  const r1 = await pedir(`${API_URL}/api/link/challenge`, { method: 'POST' }, 'el servidor del launcher');
  if (!r1.ok) throw new Error('El servidor del launcher rechazó la solicitud.');
  const { serverId } = (await r1.json()) as { serverId?: string };
  if (typeof serverId !== 'string' || !SERVER_ID_RE.test(serverId)) {
    throw new Error('El servidor del launcher envió un desafío inválido.');
  }

  // 2) Le decimos a Mojang "esta cuenta se unió a este serverId".
  //    El token de Minecraft viaja SOLO a Mojang, nunca a nuestro backend.
  const r2 = await pedir(
    MOJANG_JOIN,
    {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ accessToken: p.mcToken, selectedProfile: p.uuid, serverId }),
    },
    'Mojang',
  );
  if (r2.status !== 204) throw new Error('Mojang no pudo verificar tu sesión. Cierra sesión y vuelve a entrar.');

  // 3) Nuestro backend le pregunta a Mojang quién se unió con ese serverId
  const r3 = await pedir(
    `${API_URL}/api/link`,
    { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ username: p.name, serverId }) },
    'el servidor del launcher',
  );
  if (!r3.ok) {
    throw new Error(r3.status === 401 ? 'No se pudo verificar tu cuenta de Minecraft.' : 'No se pudo completar la vinculación.');
  }
}