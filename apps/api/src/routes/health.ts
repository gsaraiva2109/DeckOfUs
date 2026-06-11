import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/client.js';

export async function healthRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.get('/healthz', async () => ({ status: 'ok' }));

  fastify.get('/readyz', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'unready' });
    }
  });
}
