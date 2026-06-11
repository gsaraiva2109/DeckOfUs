import { env } from '../env.js';
import { prisma } from '../db/client.js';

// Cloudreve v4 OAuth2 access-token manager.
//
// v4 access tokens live only ~3600s, so a static token cannot be baked into the
// environment. Instead the operator stores a long-lived (90-day) refresh_token;
// this module exchanges it for short-lived access tokens on demand and caches
// the result, refreshing transparently shortly before expiry (or on a 401).
//
//   POST /api/v4/session/oauth/token
//   Content-Type: application/x-www-form-urlencoded
//   grant_type=refresh_token&refresh_token=...&client_id=...&client_secret=...
//   -> { access_token, refresh_token, expires_in, ... }
//
// Cloudreve v4 ROTATES the refresh_token on every refresh and hard-invalidates
// the previous one. So we cannot reuse the static env token forever — after the
// first refresh it is dead. We persist the rotated refresh_token in the DB
// (AppSetting KV) and prefer it on subsequent calls, falling back to the env
// token only when no row exists yet (first boot / fresh deploy). If a refresh
// fails with a stored token that differs from env, we drop the stored row and
// retry once with the env token, so an operator can recover by pasting a fresh
// token into the environment.

interface OAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
}

// Refresh this many ms before the real expiry to avoid racing the clock.
const SKEW_MS = 60_000;

// AppSetting key under which the rotated refresh_token is persisted.
const RT_KEY = 'cloudreve_refresh_token';

let cachedToken: string | null = null;
let expiresAt = 0; // epoch ms
let inflight: Promise<string> | null = null;

async function readStoredRefreshToken(): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: RT_KEY } });
  return row?.value ?? null;
}

async function persistRefreshToken(token: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: RT_KEY },
    create: { key: RT_KEY, value: token },
    update: { value: token },
  });
}

async function clearStoredRefreshToken(): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key: RT_KEY } });
}

// One refresh round-trip against a specific refresh_token. On success it
// persists the rotated refresh_token and primes the access-token cache.
async function refreshWith(refreshToken: string): Promise<string> {
  const base = env.CLOUDREVE_BASE_URL?.replace(/\/$/, '');
  if (!base || !env.CLOUDREVE_CLIENT_ID || !env.CLOUDREVE_CLIENT_SECRET) {
    throw new Error('Cloudreve OAuth is not configured');
  }

  const form = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: env.CLOUDREVE_CLIENT_ID,
    client_secret: env.CLOUDREVE_CLIENT_SECRET,
  });

  let res: Response;
  try {
    res = await fetch(`${base}/api/v4/session/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
  } catch (err) {
    throw new Error(`Cloudreve token refresh error: ${asMessage(err)}`);
  }

  if (!res.ok) {
    // Never echo the body — it may contain token material.
    throw new Error(`Cloudreve token refresh failed: HTTP ${res.status}`);
  }

  // The OAuth endpoint may return the raw token JSON or Cloudreve's
  // { code, data } envelope; accept either.
  const json = (await res.json()) as OAuthTokenResponse & {
    code?: number;
    msg?: string;
    data?: OAuthTokenResponse;
  };
  const tok = json.data ?? json;
  if (!tok.access_token) {
    // Surface the envelope code/msg (safe — not token material) so the prod
    // log says *why* instead of an opaque "no access_token".
    const detail =
      json.code !== undefined || json.msg
        ? ` (code=${json.code ?? '?'} msg=${json.msg ?? '?'})`
        : '';
    throw new Error(`Cloudreve token refresh returned no access_token${detail}`);
  }

  // Persist the rotated refresh_token so the next call uses it. Cloudreve
  // invalidated the one we just spent.
  if (tok.refresh_token) {
    await persistRefreshToken(tok.refresh_token);
  }

  cachedToken = tok.access_token;
  const ttlMs = (tok.expires_in ?? 3600) * 1000;
  expiresAt = Date.now() + ttlMs;
  return cachedToken;
}

async function fetchAccessToken(): Promise<string> {
  if (!env.CLOUDREVE_REFRESH_TOKEN) {
    throw new Error('Cloudreve OAuth is not configured');
  }

  const stored = await readStoredRefreshToken();
  const primary = stored ?? env.CLOUDREVE_REFRESH_TOKEN;

  try {
    return await refreshWith(primary);
  } catch (err) {
    // Recovery: a stored token went bad and the operator has rotated the env
    // token. Drop the dead stored token and retry once with the env token.
    if (stored && stored !== env.CLOUDREVE_REFRESH_TOKEN) {
      await clearStoredRefreshToken();
      return await refreshWith(env.CLOUDREVE_REFRESH_TOKEN);
    }
    throw err;
  }
}

// Return a valid Bearer access token, refreshing if the cache is empty, near
// expiry, or `forceRefresh` is set (use after a 401 to defeat a stale token).
export async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && Date.now() < expiresAt - SKEW_MS) {
    return cachedToken;
  }
  // Coalesce concurrent refreshes into a single in-flight request.
  if (!inflight) {
    inflight = fetchAccessToken().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

function asMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
