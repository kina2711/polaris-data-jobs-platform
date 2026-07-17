# Polaris web application

Next.js 15 application for browsing and semantically matching jobs stored in the
canonical PostgreSQL `raw_jobs` table.

```powershell
Copy-Item .env.example .env.local
npm ci
npm run db:validate
npm run dev
```

The development server listens on `http://localhost:3400`. See the repository
[`README.md`](../../README.md), [`docs/api.md`](../../docs/api.md), and
[`docs/development.md`](../../docs/development.md) for the complete verified
contract.

For the web-only Compose file, copy `.env.example` to `.env`, point
`DATABASE_URL` at a PostgreSQL/pgvector host reachable from the container, then
run `docker compose config` and `docker compose up --build`. `APP_PORT` changes
only the host port; the container always listens on `3400`.

Authentication providers are `NOT_IMPLEMENTED` in this repository. Do not add a
placeholder provider or assume an external cookie contract; integrate only an
approved Polaris identity provider.
