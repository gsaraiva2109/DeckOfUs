# packages/

Reserved for code shared across `apps/`. The first candidate is a `shared/`
package holding the REST/WS contract types that `apps/web` and `apps/api`
currently duplicate (session/photo/ousado payloads) — a single source of truth
consumed by both. Empty for now; add packages here as shared surface emerges.
