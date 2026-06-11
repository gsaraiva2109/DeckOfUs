import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { buildApp } from '../app.js';
import { prisma } from '../db/client.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.io.close();
  await app.close();
});

async function makePng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .png()
    .toBuffer();
}

function multipartBody(field: string, filename: string, buf: Buffer, contentType: string) {
  const boundary = '----testboundary' + Math.random().toString(16).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${field}"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, buf, tail]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

describe('session routes', () => {
  it('create -> join -> ousado(wrong=401, right=200) -> snapshot, + photo', async () => {
    // create
    const created = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { secret: 'mysecret' },
    });
    expect(created.statusCode).toBe(201);
    const { sessionId, code, organizerToken, joinUrl, qrDataUrl } =
      created.json();
    expect(code).toMatch(/^[0-9A-Z]{6}$/);
    expect(joinUrl).toContain(`?join=${code}`);
    expect(qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);

    // join
    const joined = await app.inject({
      method: 'POST',
      url: `/api/sessions/${code}/join`,
      payload: {},
    });
    expect(joined.statusCode).toBe(200);
    const { participantToken, ousadoActive } = joined.json();
    expect(ousadoActive).toBe(false);

    // ousado wrong secret -> 401
    const wrong = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/ousado`,
      headers: { authorization: `Bearer ${organizerToken}` },
      payload: { secret: 'WRONG' },
    });
    expect(wrong.statusCode).toBe(401);

    // ousado right secret -> 200
    const right = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/ousado`,
      headers: { authorization: `Bearer ${organizerToken}` },
      payload: { secret: 'mysecret' },
    });
    expect(right.statusCode).toBe(200);
    expect(right.json().ousadoActive).toBe(true);

    // guest cannot activate ousado -> 403
    const forbidden = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/ousado`,
      headers: { authorization: `Bearer ${participantToken}` },
      payload: { secret: 'mysecret' },
    });
    expect(forbidden.statusCode).toBe(403);

    // snapshot reflects ousadoActive
    const snap = await app.inject({
      method: 'GET',
      url: `/api/sessions/${code}`,
      headers: { authorization: `Bearer ${organizerToken}` },
    });
    expect(snap.statusCode).toBe(200);
    expect(snap.json().ousadoActive).toBe(true);
    expect(snap.json().participantCount).toBe(1);

    // photo upload (valid png) -> 200 with url
    const png = await makePng();
    const photoReq = multipartBody('file', 'pic.png', png, 'image/png');
    const photo = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/photo`,
      headers: {
        authorization: `Bearer ${organizerToken}`,
        ...photoReq.headers,
      },
      payload: photoReq.payload,
    });
    expect(photo.statusCode).toBe(200);
    expect(typeof photo.json().url).toBe('string');

    // snapshot now has 1 photo
    const snap2 = await app.inject({
      method: 'GET',
      url: `/api/sessions/${code}`,
      headers: { authorization: `Bearer ${organizerToken}` },
    });
    expect(snap2.json().photos.length).toBe(1);

    // non-image upload -> 415 (lying about content-type)
    const fakeReq = multipartBody(
      'file',
      'notes.png',
      Buffer.from('this is not an image, just plain text content'),
      'image/png',
    );
    const fake = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/photo`,
      headers: {
        authorization: `Bearer ${organizerToken}`,
        ...fakeReq.headers,
      },
      payload: fakeReq.payload,
    });
    expect(fake.statusCode).toBe(415);
  });

  it('health endpoints', async () => {
    const h = await app.inject({ method: 'GET', url: '/healthz' });
    expect(h.json()).toEqual({ status: 'ok' });
    const r = await app.inject({ method: 'GET', url: '/readyz' });
    expect(r.statusCode).toBe(200);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
