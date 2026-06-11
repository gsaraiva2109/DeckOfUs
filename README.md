<div align="center">

# DeckOfUs

**A real-time, two-device card game for couples.**

One player hosts a session, the other joins by scanning a QR code, and both
phones stay in sync through every level of the deck — shared prompts, a
secret-gated "bold" mode, and a closing photo the two devices capture together.

[![CI](https://github.com/gsaraiva2109/DeckOfUs/actions/workflows/deploy.yml/badge.svg)](https://github.com/gsaraiva2109/DeckOfUs/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6.svg)](https://www.typescriptlang.org/)

</div>

---

## Features

- **Synchronized two-device sessions** — one room per session, kept in lockstep
  over WebSockets (presence, state transitions, and events broadcast to both
  devices).
- **Frictionless join** — host creates a session secured by a secret; the guest
  joins via a 6-character code or a QR scan.
- **Secret-gated "bold" mode** — server-validated activation with brute-force
  lockout, broadcast to both devices simultaneously.
- **Shared photo moment** — the final screen captures a photo, uploads it, and
  surfaces it on both devices with a native share action.
- **Same-origin architecture** — the web tier reverse-proxies the API and
  WebSocket traffic, so there is no CORS surface and no deployment-specific data
  is ever baked into the published images.
- **Security by default** — Argon2id secret hashing, short-lived JWT session
  tokens, per-IP rate limiting, and hardened uploads (magic-byte sniffing, size
  caps, and re-encoding to strip metadata).

## Tech stack

| Layer     | Technology                                                                 |
| --------- | -------------------------------------------------------------------------- |
| Web       | Vite 5, React 18, TypeScript, Framer Motion, Socket.IO client              |
| API       | Node 22, Fastify 5, Socket.IO 4, Prisma 6 (SQLite), Zod, Argon2, Sharp     |
| Tooling   | Vitest, Docker, GitHub Actions, nginx                                      |

## Architecture

```
            ┌──────────────────────────────────────────────┐
  Device A ─┤                                              │
            │   web (nginx)  ──reverse proxy──▶  api        │
  Device B ─┤   static SPA      /api, /socket.io   Fastify  │
            └──────────────────────────────────────┬───────┘
                                                    │
                                       Prisma ──▶ SQLite (sessions, photos)
                                                    │
                                       Storage adapter ──▶ object storage
```

A single **session** maps to one **room** shared by two devices. State lives in
the API and database; the web tier holds no authority and simply renders the
broadcast state. Only the web service is exposed publicly — the API is reached
exclusively through its reverse proxy.

## Repository layout

This is a monorepo of independently deployable apps:

```
DeckOfUs/
├── apps/
│   ├── web/             # Vite + React SPA, served by nginx
│   │   ├── src/         #   screens/, lib/, App.tsx …
│   │   ├── public/      #   static assets (+ operator-mounted deck-config.json)
│   │   └── Dockerfile
│   └── api/             # Fastify + Socket.IO + Prisma backend
│       ├── src/         #   routes/, services/, plugins/, realtime/ …
│       ├── prisma/      #   schema + migrations
│       └── Dockerfile
├── packages/            # shared code (reserved; e.g. shared contract types)
├── .github/workflows/   # CI/CD
├── docker-compose.yml   # production stack (prebuilt images)
└── DEPLOY.md            # deployment guide
```

Each app is self-contained — its own `package.json`, lockfile, and Dockerfile —
so build contexts stay clean and the two apps can be released independently.

## Getting started

### Prerequisites

- Node.js 22+
- npm 10+

### Run locally

```bash
# 1. API — http://localhost:8080
cd apps/api
cp .env.example .env          # adjust as needed
npm install
npm run prisma:generate
npm run dev

# 2. Web — http://localhost:5173 (separate shell)
cd apps/web
npm install
npm run dev                   # proxies /api and /socket.io to :8080
```

Open the web app in two browser windows to simulate the host and guest devices.

### Configuration

The API is configured entirely through environment variables, validated at
startup (`apps/api/src/env.ts`). See `apps/api/.env.example` for the full list
and [DEPLOY.md](./DEPLOY.md) for production guidance.

The web app reads its content from `public/deck-config.json` at runtime. A
built-in placeholder is used when the file is absent, so the app runs without
any personal content checked into the repository.

## Testing

```bash
cd apps/api && npm test       # Vitest: unit, REST, and WebSocket integration
```

## Building

```bash
cd apps/web && npm run build   # static bundle → apps/web/dist
cd apps/api && npm run build   # compiled output → apps/api/dist
```

Production images for both apps are built and published by CI. See
[DEPLOY.md](./DEPLOY.md).

## Contributing

Contributions are welcome. Please:

1. Fork the repository and create a feature branch.
2. Keep changes focused and covered by tests where applicable.
3. Ensure `npm test` (API) and `npm run build` (both apps) pass.
4. Open a pull request describing the change and its motivation.

## License

Released under the [MIT License](./LICENSE).
