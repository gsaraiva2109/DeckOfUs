import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from '../env.js';
import { CloudreveStorage } from './cloudreve.js';

export interface StorageAdapter {
  upload(
    buf: Buffer,
    meta: { mime: string; ext: string },
  ): Promise<{ url: string; id?: string }>;
}

export class LocalStorage implements StorageAdapter {
  async upload(
    buf: Buffer,
    meta: { mime: string; ext: string },
  ): Promise<{ url: string; id?: string }> {
    const dir = env.LOCAL_STORAGE_DIR;
    if (!dir) {
      throw new Error('LOCAL_STORAGE_DIR is empty or not configured');
    }
    await fs.mkdir(dir, { recursive: true });
    const name = `${crypto.randomUUID()}.${meta.ext}`;
    await fs.writeFile(path.join(dir, name), buf);
    const base = env.LOCAL_PUBLIC_BASE.replace(/\/$/, '');
    return { url: `${base}/${name}` };
  }
}

let cached: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (cached) return cached;
  cached =
    env.STORAGE_DRIVER === 'local'
      ? new LocalStorage()
      : new CloudreveStorage();
  return cached;
}
