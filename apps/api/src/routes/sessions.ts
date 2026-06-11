import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { env } from '../env.js';
import { AppError } from '../lib/errors.js';
import {
  createSessionBody,
  codeParam,
  idParam,
  ousadoBody,
} from '../schemas/session.js';
import {
  createSession,
  joinSession,
  getSnapshot,
  activateOusado,
} from '../services/sessionService.js';
import { toDataUrl } from '../services/qrcode.js';
import { getStorage } from '../services/storage.js';
import { prisma } from '../db/client.js';
import { broadcastOusado, broadcastPhoto } from '../realtime/gateway.js';

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Map<string, string>([
  ['image/jpeg', 'jpeg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function handleError(reply: import('fastify').FastifyReply, err: unknown) {
  if (err instanceof AppError) {
    return reply.code(err.httpStatus).send({ error: err.code, message: err.message });
  }
  throw err;
}

export async function sessionRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  // Create a session.
  fastify.post('/api/sessions', async (req, reply) => {
    const parsed = createSessionBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', issues: parsed.error.issues });
    }
    try {
      const session = await createSession({ secret: parsed.data.secret });
      const organizerToken = fastify.jwt.sign({
        sessionId: session.id,
        role: 'organizer',
      });
      const joinUrl = `${env.PUBLIC_APP_URL}/?join=${session.code}`;
      const qrDataUrl = await toDataUrl(joinUrl);
      return reply.code(201).send({
        sessionId: session.id,
        code: session.code,
        joinUrl,
        qrDataUrl,
        organizerToken,
      });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // Join a session by code.
  fastify.post('/api/sessions/:code/join', async (req, reply) => {
    const parsed = codeParam.safeParse(req.params);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request' });
    }
    try {
      const session = await joinSession(parsed.data.code);
      const participantToken = fastify.jwt.sign({
        sessionId: session.id,
        role: 'guest',
      });
      return reply.send({
        sessionId: session.id,
        participantToken,
        status: session.status,
        ousadoActive: session.ousadoActive,
      });
    } catch (err) {
      return handleError(reply, err);
    }
  });

  // Snapshot (authenticated).
  fastify.get(
    '/api/sessions/:code',
    { preHandler: [fastify.authenticate] },
    async (req, reply) => {
      const parsed = codeParam.safeParse(req.params);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'bad_request' });
      }
      try {
        const snapshot = await getSnapshot(parsed.data.code);
        return reply.send(snapshot);
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // Activate ousado (organizer only).
  fastify.post(
    '/api/sessions/:id/ousado',
    { preHandler: [fastify.authenticateOrganizer] },
    async (req, reply) => {
      const params = idParam.safeParse(req.params);
      const body = ousadoBody.safeParse(req.body);
      if (!params.success || !body.success) {
        return reply.code(400).send({ error: 'bad_request' });
      }
      try {
        const result = await activateOusado(params.data.id, body.data.secret);
        if (result.changed) {
          broadcastOusado(fastify.io, params.data.id, 'organizer');
        }
        return reply.send({ ousadoActive: true });
      } catch (err) {
        return handleError(reply, err);
      }
    },
  );

  // Upload a photo (authenticated).
  fastify.post(
    '/api/sessions/:id/photo',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const params = idParam.safeParse(req.params);
      if (!params.success) {
        return reply.code(400).send({ error: 'bad_request' });
      }

      const session = await prisma.session.findUnique({
        where: { id: params.data.id },
      });
      if (!session) {
        return reply.code(404).send({ error: 'not_found' });
      }

      const startedAt = Date.now();
      req.log.info(
        { sessionId: session.id, role: req.user.role },
        'photo upload received',
      );

      let raw: Buffer;
      try {
        const file = await req.file({ limits: { fileSize: MAX_PHOTO_BYTES } });
        if (!file) {
          return reply.code(400).send({ error: 'bad_request', message: 'No file' });
        }
        raw = await file.toBuffer();
        if (file.file.truncated) {
          return reply
            .code(413)
            .send({ error: 'payload_too_large', message: 'File exceeds 8MB' });
        }
      } catch {
        return reply.code(413).send({ error: 'payload_too_large' });
      }

      // Sniff real type from bytes; never trust the part mimetype.
      const sniffed = await fileTypeFromBuffer(raw);
      const ext = sniffed ? ALLOWED.get(sniffed.mime) : undefined;
      if (!sniffed || !ext) {
        return reply
          .code(415)
          .send({ error: 'unsupported_media', message: 'Only jpeg/png/webp' });
      }
      req.log.info(
        { sessionId: session.id, mime: sniffed.mime, bytes: raw.length },
        'photo validated',
      );

      try {
        // Re-encode + strip metadata, honoring EXIF orientation.
        let pipeline = sharp(raw).rotate();
        if (ext === 'jpeg') pipeline = pipeline.jpeg();
        else if (ext === 'png') pipeline = pipeline.png();
        else pipeline = pipeline.webp();
        const clean = await pipeline.toBuffer();

        const stored = await getStorage().upload(clean, {
          mime: sniffed.mime,
          ext,
        });

        await prisma.photo.create({
          data: {
            sessionId: session.id,
            publicUrl: stored.url,
            cloudreveId: stored.id ?? null,
            uploadedBy: req.user.role,
          },
        });

        broadcastPhoto(fastify.io, session.id, stored.url);
        req.log.info(
          {
            sessionId: session.id,
            url: stored.url,
            driver: env.STORAGE_DRIVER,
            ms: Date.now() - startedAt,
          },
          'photo stored',
        );
        return reply.send({ url: stored.url });
      } catch (err) {
        if (err instanceof AppError) return handleError(reply, err);
        req.log.error(
          { err, sessionId: session.id, driver: env.STORAGE_DRIVER },
          'photo upload failed',
        );
        return reply.code(400).send({ error: 'upload_failed' });
      }
    },
  );
}
