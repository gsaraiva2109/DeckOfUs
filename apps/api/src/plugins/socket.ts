import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Server } from 'socket.io';
import { env } from '../env.js';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

async function socketPluginImpl(
  fastify: FastifyInstance,
): Promise<void> {
  const io = new Server(fastify.server, {
    cors: {
      origin: env.CORS_ORIGINS,
      credentials: true,
    },
  });

  // Authenticate every socket using the same JWT secret as HTTP.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        next(new Error('unauthorized'));
        return;
      }
      const payload = fastify.verifyToken(token);
      socket.data.sessionId = payload.sessionId;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  fastify.decorate('io', io);

  fastify.addHook('onClose', async () => {
    await io.close();
  });
}

// fp() so the `io` decoration propagates to the parent instance instead of
// staying in this encapsulated child scope.
export const socketPlugin = fp(socketPluginImpl, { name: 'socket' });
