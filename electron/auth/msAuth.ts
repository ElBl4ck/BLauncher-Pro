import { app } from 'electron';
import { Auth } from 'msmc';
import { MS_CLIENT_ID, MS_REDIRECT_URI } from '../config';
import type { AuthResult, AuthSession } from '../types';
import { vincularCuenta } from './linkAccount';
import { borrarToken, cargarToken, guardarToken } from './tokenStore';

// Tipos derivados de la propia librería (así no dependemos de rutas internas de msmc)
type XboxT = Awaited<ReturnType<Auth['launch']>>;
type MinecraftT = Awaited<ReturnType<XboxT['getMinecraft']>>;

// Modo desarrollo SIN login real: solo si NO está empaquetado Y se activó a propósito
const DEV_LOGIN = !app.isPackaged && process.env.LAUNCHER_DEV_LOGIN === '1';

// El estado vive SOLO en el main process. El token de Minecraft nunca llega a React.
let mc: MinecraftT | null = null;
let sesion: AuthSession | null = null;

function crearAuth(): Auth {
  // IMPORTANTE: usamos NUESTRO client_id. new Auth("select_account") usaría el del launcher oficial.
  return new Auth({ client_id: MS_CLIENT_ID, redirect: MS_REDIRECT_URI, prompt: 'select_account' });
}

// ---------- Errores ----------

const MENSAJES: Record<string, string> = {
  'error.auth.microsoft': 'No se pudo iniciar sesión en Microsoft.',
  'error.auth.xboxLive': 'No se pudo conectar con Xbox Live.',
  'error.auth.xsts.userNotFound': 'Esta cuenta de Microsoft no tiene perfil de Xbox. Créalo en xbox.com y vuelve a intentarlo.',
  'error.auth.xsts.bannedCountry': 'Xbox Live no está disponible en tu país.',
  'error.auth.xsts.child': 'Las cuentas de menores deben añadirse primero a un grupo familiar de Microsoft.',
  'error.auth.minecraft.login': 'Minecraft rechazó el inicio de sesión. Inténtalo más tarde.',
  'error.auth.minecraft.profile': 'Esta cuenta no tiene Minecraft: Java Edition.',
};

// msmc lanza un código (string) o un objeto { ts, response }
function extraerCodigo(err: unknown): string {
  if (typeof err === 'string') return err;
  const e = err as { ts?: unknown; name?: unknown } | null;
  if (typeof e?.ts === 'string') return e.ts;
  if (typeof e?.name === 'string') return e.name;
  return '';
}

function traducirError(err: unknown): { cancelado: boolean; mensaje: string } {
  const code = extraerCodigo(err);
  if (code === 'error.gui.closed') return { cancelado: true, mensaje: '' }; // cerró la ventana: no es un error

  // Elegimos la clave más específica que coincida con el código
  const clave = Object.keys(MENSAJES)
    .filter((k) => code.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return { cancelado: false, mensaje: clave ? MENSAJES[clave] : 'No se pudo iniciar sesión. Inténtalo de nuevo.' };
}

// ---------- Sesión ----------

// Vincula el UUID con el backend. Si falla, la sesión sigue activa pero marcada como "sin vincular".
async function vincular(): Promise<AuthSession> {
  if (!mc) throw new Error('Sin sesión');
  if (!mc.profile) throw new Error('Perfil de Minecraft no disponible');
  const base = { name: mc.profile.name, uuid: mc.profile.id };
  try {
    if (!mc.validate()) await mc.refresh();
    await vincularCuenta({ mcToken: mc.mcToken, ...base });
    sesion = { ...base, linked: true };
  } catch (err) {
    console.error('[auth] vinculación fallida:', err);
    sesion = { ...base, linked: false, linkError: err instanceof Error ? err.message : 'Error desconocido' };
  }
  return sesion;
}

async function establecerSesion(xbox: XboxT): Promise<AuthResult> {
  mc = await xbox.getMinecraft(); // falla aquí si la cuenta no tiene Minecraft Java
  await guardarToken(xbox.save()); // Microsoft rota el refresh token: lo guardamos de nuevo cada vez
  return { ok: true, session: await vincular() };
}

export async function login(): Promise<AuthResult> {
  if (DEV_LOGIN) {
    mc = null;
    sesion = { name: 'DevPlayer', uuid: '0'.repeat(32), linked: true, dev: true };
    return { ok: true, session: sesion };
  }
  if (MS_CLIENT_ID.startsWith('PEGA_AQUI')) {
    return { ok: false, error: 'Falta configurar el Client ID de Azure (electron/config.ts).' };
  }
  try {
    const xbox = await crearAuth().launch('electron', { width: 500, height: 650, resizable: false });
    return await establecerSesion(xbox);
  } catch (err) {
    const { cancelado, mensaje } = traducirError(err);
    if (!cancelado) {
      console.error('[auth] login fallido:', err);
      if (extraerCodigo(err) === 'error.auth.minecraft.login') {
        console.error('[auth] Si ves "Invalid app registration", el Client ID aún no está aprobado por Mojang.');
      }
    }
    return { ok: false, cancelled: cancelado, error: mensaje };
  }
}

// Al abrir el launcher: intenta entrar sin ventana usando el refresh token guardado
export async function restaurarSesion(): Promise<AuthResult> {
  if (DEV_LOGIN) return { ok: false };
  const guardado = await cargarToken();
  if (!guardado) return { ok: false };
  try {
    return await establecerSesion(await crearAuth().refresh(guardado));
  } catch (err) {
    // Token caducado o revocado (o sin red): el jugador entra con el botón normal
    console.error('[auth] no se pudo restaurar la sesión:', err);
    return { ok: false };
  }
}

export async function reintentarVinculacion(): Promise<AuthResult> {
  if (!sesion) return { ok: false };
  if (!mc) return { ok: true, session: sesion }; // sesión dev: nada que vincular
  return { ok: true, session: await vincular() };
}

export async function logout(): Promise<void> {
  mc = null;
  sesion = null;
  await borrarToken();
}

export const haySesion = () => sesion !== null;

// Para el paso 5 (lanzar el juego): devuelve la sesión de Minecraft con el token fresco.
// Nunca se expone por IPC: solo la usa el main process.
export async function obtenerMinecraft(): Promise<MinecraftT> {
  if (!mc) throw new Error('Sin sesión de Minecraft');
  if (!mc.validate()) await mc.refresh();
  return mc;
}