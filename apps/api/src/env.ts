import { z } from 'zod';

const csv = (s: string) =>
  s.split(',').map((x) => x.trim()).filter(Boolean);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGINS: z.string().default('http://localhost:5173').transform(csv),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  TOKEN_TTL: z.string().default('12h'),

  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  OUSADO_MAX_TRIES: z.coerce.number().int().positive().default(5),
  OUSADO_LOCK_MINUTES: z.coerce.number().int().positive().default(15),
  PUBLIC_APP_URL: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().default('file:./data/deckofus.db'),

  STORAGE_DRIVER: z.enum(['local', 'cloudreve']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('./data/uploads'),
  LOCAL_PUBLIC_BASE: z.string().default('http://localhost:8080/uploads'),

  // Cloudreve v4 uses OAuth2: a long-lived refresh_token is exchanged for
  // short-lived (1h) access tokens at runtime (see services/cloudreveAuth.ts).
  CLOUDREVE_BASE_URL: z.string().optional(),
  CLOUDREVE_CLIENT_ID: z.string().optional(),
  CLOUDREVE_CLIENT_SECRET: z.string().optional(),
  CLOUDREVE_REFRESH_TOKEN: z.string().optional(),
  // v4 file URI of the destination folder (namespace + path), e.g.
  // `cloudreve://my/deckofus`. The random filename is appended at upload time.
  CLOUDREVE_FOLDER: z.string().default('cloudreve://my/deckofus'),

  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map(
    (i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`,
  );
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:\n' + lines.join('\n'));
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

// Cross-field guard: cloudreve driver needs the base url + the full OAuth set.
if (env.STORAGE_DRIVER === 'cloudreve') {
  if (
    !env.CLOUDREVE_BASE_URL ||
    !env.CLOUDREVE_CLIENT_ID ||
    !env.CLOUDREVE_CLIENT_SECRET ||
    !env.CLOUDREVE_REFRESH_TOKEN
  ) {
    // eslint-disable-next-line no-console
    console.error(
      'STORAGE_DRIVER=cloudreve requires CLOUDREVE_BASE_URL, CLOUDREVE_CLIENT_ID, ' +
        'CLOUDREVE_CLIENT_SECRET and CLOUDREVE_REFRESH_TOKEN',
    );
    process.exit(1);
  }
}
