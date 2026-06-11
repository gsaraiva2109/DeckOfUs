import { env } from '../env.js';

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
// Note: Cloudreve rotates the refresh_token on each refresh. We keep the
// original env refresh_token (valid until its 90-day expiry) rather than trying
// to persist the rotated one — a stateless, restart-safe approach. If your
// instance hard-invalidates the old refresh_token on rotation, persist the new
// one instead (see HUMAN note below).

interface OAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
}

// Refresh this many ms before the real expiry to avoid racing the clock.
const SKEW_MS = 60_000;

let cachedToken: string | null = null;
let expiresAt = 0; // epoch ms
let inflight: Promise<string> | null = null;

async function fetchAccessToken(): Promise<string> {
  const base = env.CLOUDREVE_BASE_URL?.replace(/\/$/, '');
  if (
    !base ||
    !env.CLOUDREVE_CLIENT_ID ||
    !env.CLOUDREVE_CLIENT_SECRET ||
    !env.CLOUDREVE_REFRESH_TOKEN
  ) {
    throw new Error('Cloudreve OAuth is not configured');
  }

  const form = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: env.CLOUDREVE_REFRESH_TOKEN,
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
    data?: OAuthTokenResponse;
  };
  const tok = json.data ?? json;
  if (!tok.access_token) {
    throw new Error('Cloudreve token refresh returned no access_token');
  }

  cachedToken = tok.access_token;
  const ttlMs = (tok.expires_in ?? 3600) * 1000;
  expiresAt = Date.now() + ttlMs;
  return cachedToken;
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
