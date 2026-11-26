import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');
export const MATERIALS_DIR = path.resolve(UPLOADS_DIR, 'materials');
export const MEDIA_DIR = path.resolve(UPLOADS_DIR, 'media');

fs.mkdirSync(MATERIALS_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });
