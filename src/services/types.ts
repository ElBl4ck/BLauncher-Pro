export interface LauncherConfig {
    minecraft: string;
    loader: { type: 'forge' | 'fabric' | 'quilt'| 'neoforge'; version: string };
    server: { name: string; host: string; port: number };
    java: { major:number};
    ram: { min: number; max: number };
}

export interface ModInfo {
  id: string;
  name: string;
  version: string;
  fileName: string;
  url: string;
  sha256: string;
}


export type NewsCategory = 'server' | 'launcher';

export interface NewsItem {
  id: string;
  title: string;
  date: string; // ISO 8601
  category: NewsCategory;
  content: string; // markdown
  image: string | null;
}

export interface LauncherRelease {
  version: string;
  url: string;
  notes?: string;
}