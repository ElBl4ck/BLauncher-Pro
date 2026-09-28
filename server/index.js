import express from "express";
import router from "./routes/index.js";
import cors from "cors";
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const PORT = process.env.PORT ?? 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());
app.use('/api', router);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/files', express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '2kb' }));

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});