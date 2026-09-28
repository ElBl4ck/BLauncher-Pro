import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Carpeta /server/data, resuelta relativa a este archivo
const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data');

// Lee un JSON del disco en cada petición (así los cambios se ven sin reiniciar)
async function leerJson(nombre) {
  const contenido = await readFile(path.join(DATA_DIR, nombre), 'utf-8');
  return JSON.parse(contenido);
}

// Fábrica de handlers: devuelve el contenido de un archivo JSON
export const servirArchivo = (nombre, transformar = (x) => x) => async (_req, res) => {
  try {
    res.json(transformar(await leerJson(nombre)));
  } catch (err) {
    console.error(`Error leyendo ${nombre}:`, err);
    res.status(500).json({ error: 'No se pudo leer la información' });
  }
};

// Noticias ordenadas de la más reciente a la más antigua
export const ordenarNoticias = (noticias) =>
  [...noticias].sort((a, b) => new Date(b.date) - new Date(a.date));