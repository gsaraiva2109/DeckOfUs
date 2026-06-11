import { describe, it, expect, beforeAll } from 'vitest';
import argon2 from 'argon2';
import { prisma } from '../db/client.js';
import {
  generateCode,
  createSession,
  joinSession,
  activateOusado,
} from './sessionService.js';

const ALLOWED = /^[0-9A-Z]{6}$/;
const FORBIDDEN = /[O0I1LU]/;

beforeAll(async () => {
  await prisma.photo.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.session.deleteMany();
});

describe('generateCode', () => {
  it('produces 6-char codes from the safe alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(ALLOWED);
      expect(code).not.toMatch(FORBIDDEN);
    }
  });

  it('produces unique codes (no collisions in a large sample)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateCode());
    // Extremely unlikely to collide; assert near-uniqueness.
    expect(seen.size).toBeGreaterThan(990);
  });
});

describe('createSession', () => {
  it('hashes the secret (hash !== plaintext) and verifies', async () => {
    const s = await createSession({ secret: 'hunter2' });
    expect(s.secretHash).not.toBe('hunter2');
    expect(await argon2.verify(s.secretHash, 'hunter2')).toBe(true);
    expect(await argon2.verify(s.secretHash, 'wrong')).toBe(false);
    expect(s.code).toMatch(ALLOWED);
    expect(s.status).toBe('waiting');
    expect(s.ousadoActive).toBe(false);
  });
});

describe('activateOusado', () => {
  it('single-activation guard: second valid call returns changed:false', async () => {
    const s = await createSession({ secret: 'topsecret' });
    const first = await activateOusado(s.id, 'topsecret');
    expect(first.changed).toBe(true);
    const second = await activateOusado(s.id, 'topsecret');
    expect(second.changed).toBe(false);

    const row = await prisma.session.findUnique({ where: { id: s.id } });
    expect(row?.ousadoActive).toBe(true);
    expect(row?.status).toBe('active');
  });

  it('locks after OUSADO_MAX_TRIES wrong attempts', async () => {
    const max = Number(process.env.OUSADO_MAX_TRIES);
    const s = await createSession({ secret: 'correct-horse' });

    for (let i = 0; i < max; i++) {
      await expect(activateOusado(s.id, 'nope')).rejects.toMatchObject({
        httpStatus: 401,
      });
    }

    // Now locked: even a correct secret is rejected with 423.
    await expect(activateOusado(s.id, 'correct-horse')).rejects.toMatchObject({
      httpStatus: 423,
    });

    const row = await prisma.session.findUnique({ where: { id: s.id } });
    expect(row?.lockedUntil).toBeTruthy();
    expect(row?.failedTries).toBe(0);
  });
});

describe('joinSession', () => {
  it('adds a guest participant and rejects unknown codes', async () => {
    const s = await createSession({ secret: 'abcd' });
    const joined = await joinSession(s.code);
    expect(joined.id).toBe(s.id);
    const count = await prisma.participant.count({
      where: { sessionId: s.id },
    });
    expect(count).toBe(1);

    await expect(joinSession('ZZZZZZ')).rejects.toMatchObject({
      httpStatus: 404,
    });
  });
});
