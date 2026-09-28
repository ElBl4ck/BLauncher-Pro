import {Router} from "express";
import {servirArchivo, ordenarNoticias} from "../controllers/datacontrollers.js";
import { crearDesafio, vincular } from '../controllers/linkController.js';

const router = Router();

router.get("/config", servirArchivo("config.json"));
router.get("/mods", servirArchivo("mods.json"));
router.get("/news", servirArchivo("news.json", ordenarNoticias));
router.get("/launcher/latest", servirArchivo("launcher.json"));

router.post('/link/challenge', crearDesafio);
router.post('/link', vincular);

export default router;