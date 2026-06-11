// Runs in each test worker BEFORE any test module (and thus before env.ts /
// prisma client are imported). Points the app at the test sqlite database and
// forces deterministic config.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:../data/test.db';
process.env.STORAGE_DRIVER = 'local';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'test_only_jwt_secret_minimum_32_characters_xx';
process.env.OUSADO_MAX_TRIES = process.env.OUSADO_MAX_TRIES ?? '3';
process.env.OUSADO_LOCK_MINUTES = process.env.OUSADO_LOCK_MINUTES ?? '15';
