import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { io as ioClient, type Socket } from 'socket.io-client';
import { buildApp } from '../app.js';

let app: FastifyInstance;
let baseUrl: string;

beforeAll(async () => {
  app = await buildApp();
  await app.listen({ host: '127.0.0.1', port: 0 });
  const addr = app.server.address();
  if (addr && typeof addr === 'object') {
    baseUrl = `http://127.0.0.1:${addr.port}`;
  } else {
    throw new Error('no address');
  }
});

afterAll(async () => {
  await app.io.close();
  await app.close();
});

function waitFor(socket: Socket, event: string, timeoutMs = 4000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting ${event}`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });
}

describe('socket.io realtime', () => {
  it('both clients in a room receive ousado_activated after POST /ousado', async () => {
    // Create a session + organizer token via HTTP.
    const created = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { secret: 'wssecret' },
    });
    const { sessionId, code, organizerToken } = created.json();

    // A guest joins to get a guest token.
    const joined = await app.inject({
      method: 'POST',
      url: `/api/sessions/${code}/join`,
      payload: {},
    });
    const { participantToken } = joined.json();

    const a = ioClient(baseUrl, { auth: { token: organizerToken }, transports: ['websocket'] });
    const b = ioClient(baseUrl, { auth: { token: participantToken }, transports: ['websocket'] });

    await Promise.all([waitFor(a, 'connect'), waitFor(b, 'connect')]);

    const aEvent = waitFor(a, 'ousado_activated');
    const bEvent = waitFor(b, 'ousado_activated');

    // give a beat for both to join the room
    await new Promise((r) => setTimeout(r, 100));

    const res = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/ousado`,
      headers: { authorization: `Bearer ${organizerToken}` },
      payload: { secret: 'wssecret' },
    });
    expect(res.statusCode).toBe(200);

    const [pa, pb] = (await Promise.all([aEvent, bEvent])) as Array<{
      by: string;
    }>;
    expect(pa.by).toBe('organizer');
    expect(pb.by).toBe('organizer');

    a.close();
    b.close();
  });
});
