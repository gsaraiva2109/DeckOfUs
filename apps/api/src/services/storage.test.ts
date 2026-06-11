import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { LocalStorage } from './storage.js';
import { env } from '../env.js';

describe('LocalStorage', () => {
  it('writes a file and returns a URL containing the filename', async () => {
    const storage = new LocalStorage();
    const buf = Buffer.from('hello-world');
    const { url } = await storage.upload(buf, { mime: 'image/png', ext: 'png' });

    expect(url.startsWith(env.LOCAL_PUBLIC_BASE.replace(/\/$/, ''))).toBe(true);
    const name = url.split('/').pop()!;
    expect(name).toMatch(/\.png$/);

    const onDisk = await fs.readFile(path.join(env.LOCAL_STORAGE_DIR, name));
    expect(onDisk.equals(buf)).toBe(true);
  });
});
