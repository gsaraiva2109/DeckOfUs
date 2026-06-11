import Fastify, { type FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { promises as fs } from 'node:fs';
import { env } from './env.js';
import { securityPlugin } from './plugins/security.js';
import { authPlugin } from './plugins/auth.js';
import { socketPlugin } from './plugins/socket.js';
import { gateway } from './realtime/gateway.js';
import { sessionRoutes } from './routes/sessions.js';
import { healthRoutes } from './routes/health.js';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    trustProxy: env.TRUST_PROXY,
    logger: {
      level: env.NODE_ENV === 'test' ? 'silent' : 'info',
      redact: ['req.headers.authorization', 'secret', 'token'],
    },
  });

  // Ensure storage/data directories exist.
  await fs.mkdir(env.LOCAL_STORAGE_DIR, { recursive: true });

  await fastify.register(securityPlugin);
  await fastify.register(authPlugin);
  await fastify.register(multipart, {
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  });
  await fastify.register(socketPlugin);

  gateway(fastify.io);

  await fastify.register(healthRoutes);
  await fastify.register(sessionRoutes);

  return fastify;
}
