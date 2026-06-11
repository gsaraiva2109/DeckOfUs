import crypto from 'node:crypto';
import argon2 from 'argon2';
import { prisma } from '../db/client.js';
import { env } from '../env.js';
import { errors } from '../lib/errors.js';

// Crockford base32 excluding ambiguous chars (no O, 0, I, 1, L, U).
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LEN = 6;

export function generateCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return out;
}

async function generateUniqueCode(): Promise<string> {
  // Retry on unique collision.
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode();
    const existing = await prisma.session.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw errors.badRequest('Could not allocate a unique session code');
}

export async function createSession(params: {
  secret: string;
  ttlHours?: number;
}) {
  const ttlHours = params.ttlHours ?? env.SESSION_TTL_HOURS;
  const code = await generateUniqueCode();
  const secretHash = await argon2.hash(params.secret);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  return prisma.session.create({
    data: { code, secretHash, expiresAt },
  });
}

export async function joinSession(code: string) {
  const session = await prisma.session.findUnique({ where: { code } });
  if (!session) throw errors.notFound('Session not found');
  if (session.status === 'ended') throw errors.gone('Session has ended');
  if (session.expiresAt.getTime() <= Date.now()) {
    throw errors.gone('Session expired');
  }

  await prisma.participant.create({
    data: { sessionId: session.id, role: 'guest' },
  });

  return session;
}

async function findByCodeOrId(codeOrId: string) {
  const byCode = await prisma.session.findUnique({
    where: { code: codeOrId },
  });
  if (byCode) return byCode;
  return prisma.session.findUnique({ where: { id: codeOrId } });
}

export async function getSnapshot(codeOrId: string) {
  const session = await findByCodeOrId(codeOrId);
  if (!session) throw errors.notFound('Session not found');

  const [participantCount, photos] = await Promise.all([
    prisma.participant.count({ where: { sessionId: session.id } }),
    prisma.photo.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      select: { publicUrl: true },
    }),
  ]);

  return {
    status: session.status,
    ousadoActive: session.ousadoActive,
    participantCount,
    photos: photos.map((p) => p.publicUrl),
  };
}

export async function activateOusado(sessionId: string, secret: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });
  if (!session) throw errors.notFound('Session not found');

  const now = Date.now();
  if (session.lockedUntil && session.lockedUntil.getTime() > now) {
    throw errors.locked('Too many attempts, try again later');
  }

  const valid = await argon2.verify(session.secretHash, secret);
  if (!valid) {
    const nextTries = session.failedTries + 1;
    if (nextTries >= env.OUSADO_MAX_TRIES) {
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          failedTries: 0,
          lockedUntil: new Date(now + env.OUSADO_LOCK_MINUTES * 60 * 1000),
        },
      });
    } else {
      await prisma.session.update({
        where: { id: sessionId },
        data: { failedTries: nextTries },
      });
    }
    throw errors.invalidSecret('Invalid secret');
  }

  // Valid secret: reset failure counters.
  if (session.ousadoActive) {
    if (session.failedTries !== 0 || session.lockedUntil) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { failedTries: 0, lockedUntil: null },
      });
    }
    return { changed: false };
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      ousadoActive: true,
      status: 'active',
      failedTries: 0,
      lockedUntil: null,
    },
  });
  return { changed: true };
}

export async function endSession(sessionId: string) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { status: 'ended' },
  });
}
