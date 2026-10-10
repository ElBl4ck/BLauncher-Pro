import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// En ES Modules no existe __dirname por defecto, lo simulamos así:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de rutas
const MODS_DIR = path.join(__dirname, '../public/mods');
const OUTPUT_FILE = path.join(__dirname, '../data/mods.json');
const BASE_URL = 'http://localhost:3001/files/mods';

function calculateSHA256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex').toLowerCase()));
    stream.on('error', err => reject(err));
  });
}

async function generateModsJson() {
  try {
    if (!fs.existsSync(MODS_DIR)) {
      console.error(`La carpeta ${MODS_DIR} no existe.`);
      return;
    }

    let existingMods = [];
    if (fs.existsSync(OUTPUT_FILE)) {
      try {
        const raw = fs.readFileSync(OUTPUT_FILE, 'utf-8');
        existingMods = JSON.parse(raw);
      } catch {
        console.warn('No se pudo leer mods.json previo, se generará desde cero.');
      }
    }

    const existingMap = new Map(existingMods.map(m => [m.fileName, m]));
    const files = fs.readdirSync(MODS_DIR);
    const jarFiles = files.filter(file => file.endsWith('.jar'));

    console.log(`Procesando ${jarFiles.length} mods en la carpeta...`);

    const newList = [];

    for (const fileName of jarFiles) {
      const filePath = path.join(MODS_DIR, fileName);
      const sha256 = await calculateSHA256(filePath);
      const prev = existingMap.get(fileName) || {};

      const cleanName = fileName.replace('.jar', '');
      const fallbackId = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-');

      newList.push({
        id: prev.id || fallbackId,
        name: prev.name || cleanName,
        version: prev.version || '1.0.0',
        fileName: fileName,
        url: `${BASE_URL}/${fileName}`,
        sha256: sha256
      });

      console.log(`${fileName} -> ${sha256.substring(0, 10)}...`);
    }

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(newList, null, 2), 'utf-8');

    console.log(`\n¡Listo! Guardado en ${OUTPUT_FILE} con ${newList.length} mods.`);
  } catch (error) {
    console.error('Error al generar mods.json:', error);
  }
}

generateModsJson();