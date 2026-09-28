import type {LauncherConfig, ModInfo, NewsItem, LauncherRelease} from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function get<T>(ruta: string, timeoutMs = 8000): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${API_URL}${ruta}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`Error ${res.status} en ${ruta}`);
        return await res.json() as T;
    } finally {
        clearTimeout(timer);
    }
}

export const api = {
    getConfig: () => get<LauncherConfig>('/config'),
    getNews: () => get<NewsItem[]>('/news'),
    getMods: () => get<ModInfo[]>('/mods'),
    getLauncherRelease: () => get<LauncherRelease>('/launcher')
};