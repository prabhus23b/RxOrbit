import fs from 'node:fs/promises';
import path from 'node:path';
import { MATERIALS_DIR, MEDIA_DIR, UPLOADS_DIR } from './paths';
import { safeResolveInside, sanitizeFileName } from './security';

const SUPABASE_PREFIX = 'supabase:';

let bucketEnsured = false;
let bucketEnsurePromise: Promise<void> | null = null;

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '') || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'rxorbit-uploads';
  return { url, serviceRoleKey, bucket };
}

export function isSupabaseStorageConfigured(): boolean {
  const { url, serviceRoleKey } = getSupabaseConfig();
  return Boolean(url && serviceRoleKey);
}

export function getStorageMode(): 'supabase' | 'local' {
  return isSupabaseStorageConfigured() ? 'supabase' : 'local';
}

export function sanitizeStorageKey(rawKey: string): string | null {
  const cleaned = rawKey.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!cleaned || cleaned.includes('\0')) return null;
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length === 0 || parts.some((part) => part === '.' || part === '..')) {
    return null;
  }
  return parts.join('/');
}

export function inferContentType(filename: string, fallback = 'application/octet-stream'): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return fallback;
}

async function ensureSupabaseBucketExists(): Promise<void> {
  if (bucketEnsured) return;
  if (!bucketEnsurePromise) {
    bucketEnsurePromise = (async () => {
      const { url, serviceRoleKey, bucket } = getSupabaseConfig();
      if (!url || !serviceRoleKey) return;

      const checkRes = await fetch(`${url}/storage/v1/bucket/${encodeURIComponent(bucket)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
      });

      if (checkRes.ok) {
        bucketEnsured = true;
        return;
      }

      if (checkRes.status === 404 || checkRes.status === 400) {
        const createRes = await fetch(`${url}/storage/v1/bucket`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: bucket,
            name: bucket,
            public: false,
          }),
        });
        if (!createRes.ok && createRes.status !== 409) {
          throw new Error(`Failed to initialize Supabase storage bucket (${createRes.status}).`);
        }
        bucketEnsured = true;
        return;
      }

      throw new Error(`Unable to verify Supabase storage bucket (${checkRes.status}).`);
    })().catch((err) => {
      bucketEnsurePromise = null;
      throw err;
    });
  }
  await bucketEnsurePromise;
}

export async function uploadBufferToSupabase(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const safeKey = sanitizeStorageKey(key);
  if (!safeKey) {
    throw new Error('Invalid storage object key.');
  }
  const { url, serviceRoleKey, bucket } = getSupabaseConfig();
  if (!url || !serviceRoleKey) {
    throw new Error('Supabase Storage is not configured.');
  }

  await ensureSupabaseBucketExists();

  const encodedPath = safeKey.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    throw new Error(`Supabase Storage upload failed (${res.status}).`);
  }

  return safeKey;
}

async function downloadBufferFromSupabase(
  key: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const safeKey = sanitizeStorageKey(key);
  if (!safeKey) return null;

  const { url, serviceRoleKey, bucket } = getSupabaseConfig();
  if (!url || !serviceRoleKey) return null;

  const encodedPath = safeKey.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
    },
  });

  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) {
    throw new Error(`Supabase Storage download failed (${res.status}).`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: res.headers.get('content-type') || inferContentType(safeKey),
  };
}

async function deleteObjectFromSupabase(key: string): Promise<void> {
  const safeKey = sanitizeStorageKey(key);
  if (!safeKey) return;

  const { url, serviceRoleKey, bucket } = getSupabaseConfig();
  if (!url || !serviceRoleKey) return;

  const res = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefixes: [safeKey] }),
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(`Supabase Storage delete failed (${res.status}).`);
  }
}

async function removeLocalFileQuietly(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore cleanup error
  }
}

export async function persistMaterialUpload(file: {
  path: string;
  filename: string;
  mimetype?: string;
}): Promise<string> {
  const key = `materials/${sanitizeFileName(file.filename)}`;
  if (!isSupabaseStorageConfigured()) {
    return key;
  }

  const buffer = await fs.readFile(file.path);
  await uploadBufferToSupabase(key, buffer, file.mimetype || 'application/pdf');
  await removeLocalFileQuietly(file.path);
  return `${SUPABASE_PREFIX}${key}`;
}

export async function persistMediaUpload(file: {
  path: string;
  filename: string;
  mimetype?: string;
}): Promise<string> {
  const safeFilename = sanitizeFileName(file.filename);
  const key = `media/${safeFilename}`;
  if (isSupabaseStorageConfigured()) {
    const buffer = await fs.readFile(file.path);
    await uploadBufferToSupabase(key, buffer, file.mimetype || inferContentType(safeFilename));
    await removeLocalFileQuietly(file.path);
  }
  return `/uploads/media/${safeFilename}`;
}

export async function readStoredMaterial(
  storedPath: string
): Promise<{ buffer: Buffer; localPath?: string } | null> {
  if (storedPath.startsWith(SUPABASE_PREFIX)) {
    const key = storedPath.slice(SUPABASE_PREFIX.length);
    const downloaded = await downloadBufferFromSupabase(key);
    return downloaded ? { buffer: downloaded.buffer } : null;
  }

  const safePath = safeResolveInside(UPLOADS_DIR, storedPath);
  if (safePath) {
    try {
      const buffer = await fs.readFile(safePath);
      return { buffer, localPath: safePath };
    } catch {
      // fall through to Supabase Storage check if migrated
    }
  }

  if (isSupabaseStorageConfigured()) {
    const downloaded = await downloadBufferFromSupabase(storedPath);
    return downloaded ? { buffer: downloaded.buffer } : null;
  }

  return null;
}

export async function readStoredMedia(
  filename: string
): Promise<{ buffer: Buffer; contentType: string; localPath?: string } | null> {
  const safeName = sanitizeFileName(filename);
  const safePath = safeResolveInside(MEDIA_DIR, safeName);
  if (safePath) {
    try {
      const buffer = await fs.readFile(safePath);
      return {
        buffer,
        contentType: inferContentType(safeName),
        localPath: safePath,
      };
    } catch {
      // fall through to Supabase Storage lookup
    }
  }

  if (isSupabaseStorageConfigured()) {
    return downloadBufferFromSupabase(`media/${safeName}`);
  }

  return null;
}

export async function deleteStoredMaterial(storedPath: string): Promise<void> {
  if (storedPath.startsWith(SUPABASE_PREFIX)) {
    await deleteObjectFromSupabase(storedPath.slice(SUPABASE_PREFIX.length));
    return;
  }

  const safePath = safeResolveInside(UPLOADS_DIR, storedPath);
  if (safePath) {
    await removeLocalFileQuietly(safePath);
  }
  if (isSupabaseStorageConfigured()) {
    await deleteObjectFromSupabase(storedPath);
  }
}

export async function listLocalUploadFiles(): Promise<{
  materials: Array<{ filename: string; fullPath: string; key: string }>;
  media: Array<{ filename: string; fullPath: string; key: string }>;
}> {
  const readDirFiles = async (dir: string, prefix: string) => {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries
        .filter((e) => e.isFile() && !e.name.startsWith('.'))
        .map((e) => ({
          filename: e.name,
          fullPath: path.join(dir, e.name),
          key: `${prefix}/${e.name}`,
        }));
    } catch {
      return [];
    }
  };

  const [materials, media] = await Promise.all([
    readDirFiles(MATERIALS_DIR, 'materials'),
    readDirFiles(MEDIA_DIR, 'media'),
  ]);
  return { materials, media };
}
