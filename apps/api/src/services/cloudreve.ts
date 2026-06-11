import crypto from 'node:crypto';
import { env } from '../env.js';
import { getAccessToken } from './cloudreveAuth.js';
import type { StorageAdapter } from './storage.js';

// CloudreveStorage forwards uploads to a Cloudreve v4 instance.
//
// Auth is OAuth2: cloudreveAuth.ts trades the env refresh_token for short-lived
// Bearer access tokens; this adapter just asks for one per request and retries
// once on a 401 (token expired mid-flight).
//
// Upload contract — confirmed against cloudreve/cloudreve master:
//   routers/router.go, service/explorer/upload.go, service/explorer/response.go
//
//   1. Create upload session
//        PUT /api/v4/file/upload
//        body (JSON): { uri, size, mime_type, last_modified }
//          - uri: full destination file URI, e.g. cloudreve://my/deckofus/<name>
//        -> data: { session_id, chunk_size, upload_urls?, uri, ... }
//
//   2. Upload each chunk  (local/master storage policy)
//        POST /api/v4/file/upload/{session_id}/{index}
//        Content-Type: application/octet-stream ; body: raw chunk bytes
//        index = 0..ceil(size/chunk_size)-1
//      For a local policy `upload_urls` is empty and chunks go straight to the
//      master; no completion callback is required. (Presigned-URL policies such
//      as S3/OneDrive are NOT supported here — see the guard below.)
//
//   3. Resolve a public direct link
//        PUT /api/v4/file/source
//        body (JSON): { uris: [uri] }
//        -> data: [ { link, file_url } ]   (link = the shareable direct URL)
//      Requires source/direct links to be enabled on the storage policy and the
//      OAuth user to hold the matching scope. HUMAN: if direct links are
//      disabled, this step fails with a non-zero code — enable them or swap this
//      for a share-link step (PUT /api/v4/share).
//
// Every Cloudreve response is wrapped { code, msg, data } where code === 0 means
// success (docs.cloudreve.org/en/api/overview).

const V4 = '/api/v4';

interface Envelope<T> {
  code: number;
  msg?: string;
  data?: T;
}

interface UploadSession {
  session_id: string;
  chunk_size: number;
  upload_urls?: string[];
  uri: string;
}

interface DirectLink {
  link: string;
  file_url: string;
}

export class CloudreveStorage implements StorageAdapter {
  async upload(
    buf: Buffer,
    meta: { mime: string; ext: string },
  ): Promise<{ url: string; id?: string }> {
    const base = env.CLOUDREVE_BASE_URL?.replace(/\/$/, '');
    if (!base) {
      throw new Error('Cloudreve storage is not configured');
    }

    // Never trust client-provided names: generate a random filename, then build
    // the full v4 file URI from the configured destination folder.
    const filename = `${crypto.randomUUID()}.${meta.ext}`;
    const fileUri = `${env.CLOUDREVE_FOLDER.replace(/\/$/, '')}/${filename}`;

    const session = await this.createSession(base, fileUri, buf.length, meta.mime);
    if (!session.session_id || session.chunk_size <= 0) {
      throw new Error('Cloudreve create-session returned an invalid session');
    }
    if (session.upload_urls && session.upload_urls.length > 0) {
      // Presigned-URL policy (S3/OneDrive/etc.): the chunk loop below targets the
      // master only, so refuse rather than silently misbehave.
      throw new Error(
        'Cloudreve policy returned presigned upload URLs; only local/master ' +
          'storage policies are supported',
      );
    }

    await this.uploadChunks(base, session, buf);

    const url = await this.directLink(base, session.uri || fileUri);
    return { url, id: session.session_id };
  }

  private async createSession(
    base: string,
    uri: string,
    size: number,
    mime: string,
  ): Promise<UploadSession> {
    try {
      const res = await authedFetch(`${base}${V4}/file/upload`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uri,
          size,
          mime_type: mime,
          last_modified: Date.now(),
        }),
      });
      return await readEnvelope<UploadSession>(res, 'create-session');
    } catch (err) {
      throw new Error(`Cloudreve create-session error: ${asMessage(err)}`);
    }
  }

  private async uploadChunks(
    base: string,
    session: UploadSession,
    buf: Buffer,
  ): Promise<void> {
    const chunkSize = session.chunk_size;
    const total = Math.max(1, Math.ceil(buf.length / chunkSize));
    try {
      for (let index = 0; index < total; index++) {
        const start = index * chunkSize;
        const end = Math.min(start + chunkSize, buf.length);
        const chunk = buf.subarray(start, end);

        const res = await authedFetch(
          `${base}${V4}/file/upload/${session.session_id}/${index}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: new Uint8Array(chunk),
          },
        );
        await readEnvelope<unknown>(res, `chunk ${index}/${total}`);
      }
    } catch (err) {
      throw new Error(`Cloudreve chunk upload error: ${asMessage(err)}`);
    }
  }

  private async directLink(base: string, uri: string): Promise<string> {
    try {
      const res = await authedFetch(`${base}${V4}/file/source`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [uri] }),
      });
      const links = await readEnvelope<DirectLink[]>(res, 'direct-link');
      const link = links?.[0]?.link;
      if (!link) {
        throw new Error(
          'no link returned (enable source/direct links on the storage policy)',
        );
      }
      return link;
    } catch (err) {
      throw new Error(`Cloudreve direct-link error: ${asMessage(err)}`);
    }
  }
}

// Bearer-authenticated fetch that refreshes the token and retries once on 401.
async function authedFetch(
  url: string,
  init: RequestInit & { headers?: Record<string, string> },
  retry = true,
): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 && retry) {
    await getAccessToken(true); // force a refresh, then retry exactly once
    return authedFetch(url, init, false);
  }
  return res;
}

// Unwrap Cloudreve's { code, data } envelope, raising a clean error otherwise.
async function readEnvelope<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    throw new Error(`${label} failed: HTTP ${res.status}`);
  }
  const body = (await res.json()) as Envelope<T>;
  if (body.code !== 0) {
    throw new Error(`${label} rejected: code ${body.code}`);
  }
  return body.data as T;
}

// Extract a safe message from an unknown thrown value without leaking secrets.
function asMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
