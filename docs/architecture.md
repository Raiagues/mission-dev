# Architecture

Norte is a React and Vite client backed by a Fastify API. Production serves both from one HTTPS origin.

## Client

React pages render the mission memory and conception workspaces. `src/lib/missionModel.ts` keeps deterministic engineering rules separate from interface state. Local storage remains an offline fallback and migrates the previous Mission Dev keys without discarding browser data.

## API

`server/app.mjs` owns authentication, authorization, team profiles, artifacts, workspace persistence and the private Gemini proxy. JSON Schema validates public request boundaries and Swagger documents the API at `/docs`.

## Persistence

Local development uses an atomic JSON file. When `DATABASE_URL` exists, `server/postgres-store.mjs` stores the same versioned state in PostgreSQL with transactions and row locking. Accounts, hashed sessions, project documents and exploration maps survive restarts.

## Delivery

- GitHub Pages builds a browser-only demonstration with local data and no secrets.
- Render builds the production bundle and serves it with the Fastify API.
- Neon supplies persistent PostgreSQL for the hosted service.
- GitHub Actions runs quality and security checks before Pages or Render deployment.

The current cloud state represents one team. Multi-tenant separation is required before multiple independent organizations share one deployment.
