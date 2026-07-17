# Deployment guide

## Supported repository-defined paths

The repository defines three deployable/automated paths:

1. Docker Compose for the full local or single-host stack.
2. A GitHub Actions daily TopCV crawler targeting an external PostgreSQL URL.
3. A GitHub Actions hourly call to a deployed Polaris web alert endpoint.

Cloud provider infrastructure, DNS, TLS termination, and identity-provider
configuration are not encoded here and remain `NEEDS_CONFIRMATION`.

## Docker Compose

Prepare a non-committed `.env`, then validate and build:

```powershell
Copy-Item .env.example .env
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

Required production changes:

- Replace every placeholder password/token and `CUBEJS_API_SECRET`.
- Set `NEXT_PUBLIC_SITE_URL` to the HTTPS public origin.
- Keep `CUBEJS_DEV_MODE=false`.
- Provision the `DAGSTER_DB_NAME` and `METABASE_DB_NAME` databases separately
  from `DB_NAME`; the local init SQL does this only for a fresh Compose volume.
- Do not publish PostgreSQL, Redis, MinIO, Dagster, Cube, or Metabase ports to
  an untrusted network without independent access controls.
- Configure TLS at the reverse proxy/load balancer.
- Set `TRUST_PROXY_HEADERS=true` only when direct access is blocked and proxy
  headers are overwritten by the trusted proxy.
- Configure persistent volume backup/restore outside this repository.

The web image runs `npm run start`; it does not depend on Next.js standalone
output. The Dagster image installs `data/dagster/requirements.txt` and runs
`dbt parse` during build so a missing/invalid manifest fails early.

## Database rollout

- Fresh local volume: init SQL runs automatically; then register the historical
  empty baseline and deploy the active migration:

```powershell
docker compose exec -T web npx prisma migrate resolve --applied 20260422140000_jobs_baseline
docker compose exec -T web npx prisma migrate deploy
```

- Existing environment: run from `apps/web/`:

```powershell
npm ci
npx prisma migrate deploy
npm run db:validate
```

Back up the target database before applying migrations. The committed alignment
migration is additive/idempotent for the shared schema, but migration history
must still be reviewed per environment.

## Daily cloud crawler

Workflow: `.github/workflows/daily-crawl.yml`.

GitHub repository secrets:

- `DATABASE_URL`: PostgreSQL URL with pgvector privileges and write access.
- `DISCORD_WEBHOOK_URL`: optional notification webhook.

The workflow runs daily at `00:00 UTC` and supports manual dispatch. It has a
45-minute timeout. The first model download needs outbound access to the model
registry.

## Hourly alert digest

Workflow: `.github/workflows/hourly-digest.yml`.

GitHub repository secrets:

- `POLARIS_WEB_URL`: deployed HTTPS web origin, without an endpoint suffix.
- `INTERNAL_DIGEST_TOKEN`: exactly the token configured in the web runtime.

The call runs at minute 7 of every hour. Application logic selects only alerts
whose local time is 08:00, so the hourly schedule supports multiple timezones.
Redis must be available for the duplicate-run lock and SMTP must be configured.

## Deployment verification

1. `GET /api/health` returns `200` and `checks.db=true`.
2. Unauthenticated `POST /api/vectorize` returns `401`.
3. A request with the configured token returns a vectorization result.
4. Dagster loads all assets and a materialization can write one known test row.
5. `POST /api/match` returns the documented contract.
6. Cube rejects a request without valid auth when not in development mode.
7. A manually triggered digest reports a lock/result without exposing tokens.
8. Review application/Dagster logs without printing credentials.

## Rollback

- Application: redeploy the prior image/tag.
- Workflow: revert the workflow/script change and rerun only after checking
  cursor/idempotency impact.
- Database: use a reviewed forward migration or restore a backup. Do not delete
  Prisma migration files already applied to a shared environment.

No automatic rollback or infrastructure-as-code stack is present.
