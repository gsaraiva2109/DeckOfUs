# Deployment Guide

DeckOfUs is distributed as two container images:

| Service    | Description                                                       | Exposure       |
| ---------- | ----------------------------------------------------------------- | -------------- |
| `backend`  | Fastify + Socket.IO + Prisma (SQLite) API, listening on `:8080`.  | **Internal**   |
| `frontend` | Vite/React static SPA served by nginx on `:80`.                   | **Public**     |

Only the `frontend` is published to the outside world. It reverse-proxies
`/api` and `/socket.io` to the `backend` over the internal network, so the API
is never exposed directly. This same-origin design means no CORS configuration
and no deployment-specific values are baked into the images.

## 1. Pipeline overview

```
push to main ─▶ GitHub Actions ─▶ build + push images to GHCR
                                          │
                                          ▼
                            notify the deployment target
                                          │
                                          ▼
              target pulls :latest ─▶ frontend (public) ─▶ backend (internal)
```

The CI workflow (`.github/workflows/deploy.yml`) builds both images, pushes them
to the GitHub Container Registry (`ghcr.io`), and then signals the deployment
target to pull and roll out the new images. `docker-compose.yml` references the
**prebuilt images** — there is no build step at deploy time.

## 2. Container images

Images are published to GHCR on every push to `main`, tagged `:latest` and
`:sha-<short>`:

- `ghcr.io/<owner>/deckofus-backend`
- `ghcr.io/<owner>/deckofus-frontend`

Pushing uses the workflow's built-in `GITHUB_TOKEN`; the images are public, so
no additional registry credentials are required to pull them.

## 3. Deploying the stack

Deploy `docker-compose.yml` on any Docker-compatible host or orchestrator. The
environment must provide the following:

1. **Public routing** to the `frontend` service (port `80`) via your reverse
   proxy or ingress. Do **not** expose the `backend`.
2. **Environment variables** for the `backend` (section 4) to fill the `${VAR}`
   placeholders in the compose file.
3. **A persistent volume** for the backend data directory (section 6).
4. **The `deck-config.json` mount** for the frontend (section 5).

## 4. Environment variables

Defined on the `backend` service. The API validates these at startup and exits
on invalid configuration.

| Variable                  | Guidance                                                                     |
| ------------------------- | ---------------------------------------------------------------------------- |
| `NODE_ENV`                | `production`.                                                                 |
| `PORT`                    | `8080` (listen port; matches the healthcheck).                               |
| `HOST`                    | `0.0.0.0`.                                                                    |
| `CORS_ORIGINS`            | Public frontend origin, e.g. `https://app.example.com` (comma-separated).    |
| `JWT_SECRET`              | **32+ random characters.** Generate with `openssl rand -base64 48`.          |
| `TOKEN_TTL`               | Session token lifetime, e.g. `12h`.                                          |
| `SESSION_TTL_HOURS`       | Game session lifetime in hours, e.g. `12`.                                   |
| `OUSADO_MAX_TRIES`        | Failed attempts before lockout, e.g. `5`.                                    |
| `OUSADO_LOCK_MINUTES`     | Lockout duration in minutes, e.g. `15`.                                      |
| `PUBLIC_APP_URL`          | Public frontend origin (embedded in the QR join URL).                        |
| `DATABASE_URL`            | `file:./data/deckofus.db` (resides on the persistent volume).                |
| `STORAGE_DRIVER`          | `local` or `cloudreve`. Use `cloudreve` for durable external photo storage.  |
| `LOCAL_STORAGE_DIR`       | `./data/uploads` (used when `STORAGE_DRIVER=local`).                         |
| `LOCAL_PUBLIC_BASE`       | If `local`: public URL uploads are served from.                              |
| `CLOUDREVE_BASE_URL`      | If `cloudreve`: the Cloudreve instance base URL.                             |
| `CLOUDREVE_CLIENT_ID`     | If `cloudreve`: OAuth application Client ID.                                 |
| `CLOUDREVE_CLIENT_SECRET` | If `cloudreve`: OAuth application Client Secret.                             |
| `CLOUDREVE_REFRESH_TOKEN` | If `cloudreve`: long-lived refresh token (see below).                       |
| `CLOUDREVE_FOLDER`        | If `cloudreve`: destination URI, e.g. `cloudreve://my/deckofus`.            |
| `TRUST_PROXY`             | **`true`** when behind a reverse proxy, so rate limiting keys off the real client IP. |

> The backend exits at boot if `JWT_SECRET` is shorter than 32 characters, or if
> `STORAGE_DRIVER=cloudreve` without `CLOUDREVE_BASE_URL`, `CLOUDREVE_CLIENT_ID`,
> `CLOUDREVE_CLIENT_SECRET`, and `CLOUDREVE_REFRESH_TOKEN`.

### Cloudreve storage (optional)

The `cloudreve` driver targets a Cloudreve v4 instance over OAuth 2.0. Access
tokens are short-lived, so the backend stores a long-lived **refresh token** and
mints access tokens at runtime. To obtain one:

1. **Register an OAuth application** in the Cloudreve dashboard. Set a redirect
   URI you can read back from the address bar, and request the scopes
   `openid Files.Write offline_access`. Record the **Client ID** and **Client
   Secret**.
2. **Authorize once**, signed in as the upload-owning user:
   ```
   https://<cloudreve-host>/session/authorize?response_type=code&client_id=<CLIENT_ID>&redirect_uri=<REGISTERED_URI>&scope=openid%20Files.Write%20offline_access&state=x
   ```
   Approve, then copy the `code` parameter from the redirected URL.
3. **Exchange the code** for tokens (codes expire within minutes):
   ```bash
   curl -X POST https://<cloudreve-host>/api/v4/session/oauth/token \
     -H 'Content-Type: application/x-www-form-urlencoded' \
     -d grant_type=authorization_code -d client_id=<CLIENT_ID> \
     -d client_secret=<CLIENT_SECRET> -d code=<CODE> -d redirect_uri=<REGISTERED_URI>
   ```
   Store the returned `refresh_token` as `CLOUDREVE_REFRESH_TOKEN`.

> Public photo links require **direct/source links** to be enabled on the target
> storage policy.

## 5. Application content

The frontend serves its content from `/usr/share/nginx/html/deck-config.json`.
This file is **operator-provided** and not included in the repository. Mount your
file to that path on the `frontend` service:

```yaml
# frontend.volumes
- ./deck-config.json:/usr/share/nginx/html/deck-config.json:ro
```

If the file is absent, the app falls back to a built-in placeholder, so the
stack still boots before the real content is supplied.

## 6. Persistence & backups

The backend stores the SQLite database (`deckofus.db`) and uploaded photos
(`uploads/`) under `/app/data`. This path **must** be backed by a persistent
volume (`deckofus_data` in the compose file); otherwise data is lost on every
redeploy.

Back up the volume with:

```bash
docker run --rm \
  -v deckofus_data:/data -v "$PWD":/backup \
  alpine tar czf /backup/deckofus_data.tar.gz -C /data .
```

Restore by extracting the archive back into the volume.

## 7. Releases

Every push to `main` rebuilds and republishes both images and rolls out the
update automatically. The workflow can also be run on demand from the GitHub
Actions tab (`workflow_dispatch`).
