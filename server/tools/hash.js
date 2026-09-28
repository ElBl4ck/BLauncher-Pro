import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
if (!file) {
  console.error('Uso: npm run hash -- ruta/al/mod.jar');
  process.exit(1);
}

const hash = createHash('sha256');
createReadStream(file)
  .on('data', (c) => hash.update(c))
  .on('end', () => {
    // Imprime un bloque listo para pegar en mods.json
    console.log(JSON.stringify({
      fileName: path.basename(file),
      sha256: hash.digest('hex'),
    }, null, 2));
  });