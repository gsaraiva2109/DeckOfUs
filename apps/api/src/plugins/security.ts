import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from '../env.js';

async function securityPluginImpl(
  fastify: FastifyInstance,
): Promise<void> {
  await fastify.register(helmet, {
    // Allow cross-origin loading of stored images.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await fastify.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
  });

  await fastify.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req: FastifyRequest) => {
      const cf = req.headers['cf-connecting-ip'];
      if (typeof cf === 'string' && cf.length > 0) return cf;
      return req.ip;
    },
  });
}

// fp() so helmet / cors / rate-limit hooks apply to routes registered on the
// parent instance rather than only within this encapsulated child scope.
export const securityPlugin = fp(securityPluginImpl, { name: 'security' });
