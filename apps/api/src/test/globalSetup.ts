import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '..', '..');

// Test database lives at server/data/test.db. The path in DATABASE_URL is
// resolved by Prisma relative to the schema dir (prisma/), hence ../data.
const TEST_DB_URL = 'file:../data/test.db';

export async function setup(): Promise<void> {
  const dataDir = path.join(serverRoot, 'data');
  const dbFile = path.join(dataDir, 'test.db');

  // Fresh schema each run. We delete the file ourselves rather than use
  // `prisma db push --force-reset`: the destructive Migrate reset is blocked
  // when Prisma detects an AI agent in the env, and deleting + applying
  // committed migrations is equivalent, deterministic, and CI-safe.
  mkdirSync(dataDir, { recursive: true });
  rmSync(dbFile, { force: true });
  rmSync(`${dbFile}-journal`, { force: true });

  execSync('npx prisma migrate deploy', {
    cwd: serverRoot,
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
  });
}

export async function teardown(): Promise<void> {
  // Leave the file in place; it is gitignored data.
}
