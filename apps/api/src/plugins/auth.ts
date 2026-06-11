import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { env } from '../env.js';

export interface JwtPayload {
  sessionId: string;
  role: 'organizer' | 'guest';
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (
      req: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
    authenticateOrganizer: (
      req: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
    verifyToken: (token: string) => JwtPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

async function authPluginImpl(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.TOKEN_TTL },
  });

  fastify.decorate(
    'authenticate',
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await req.jwtVerify();
      } catch {
        reply.code(401).send({ error: 'unauthorized' });
      }
    },
  );

  fastify.decorate(
    'authenticateOrganizer',
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await req.jwtVerify();
      } catch {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      if (req.user.role !== 'organizer') {
        return reply.code(403).send({ error: 'forbidden' });
      }
    },
  );

  // Shared verify used by the Socket.IO auth middleware so it reuses the
  // same secret/algorithm as the HTTP layer.
  fastify.decorate('verifyToken', (token: string): JwtPayload => {
    return fastify.jwt.verify<JwtPayload>(token);
  });
}

// fp() so the auth decorations (authenticate / authenticateOrganizer /
// verifyToken) and the @fastify/jwt registration reach the parent instance
// and are usable by routes and the socket plugin.
export const authPlugin = fp(authPluginImpl, { name: 'auth' });
