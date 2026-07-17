# Development guide

## Local integrated stack

1. Install Docker Desktop with Compose v2.
2. Copy `.env.example` to `.env` and replace placeholder secrets.
3. Validate the rendered configuration with `docker compose config`.
4. Start with `docker compose up --build`.

The root README lists exposed ports. The init SQL runs only when PostgreSQL
creates a fresh volume and also provisions isolated Dagster/Metabase metadata
databases. Follow the README baseline command once for a fresh volume; use
Prisma migrations normally for an existing database.

## Web application

Requirements: Node.js 20 and npm.

```powershell
Set-Location apps/web
Copy-Item .env.example .env.local
npm ci
npm run db:validate
npm run dev
```

Available scripts:

| Command                | Purpose                                               |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | Next.js development server on port 3400.              |
| `npm run build`        | Generate Prisma client and create a production build. |
| `npm run start`        | Run the production server on port 3400.               |
| `npm run lint`         | ESLint with zero warnings allowed.                    |
| `npm run typecheck`    | TypeScript no-emit check.                             |
| `npm test`             | Vitest unit tests.                                    |
| `npm run format:check` | Prettier verification.                                |
| `npm run db:validate`  | Validate the Prisma schema.                           |

Do not use `npm install` when reproducing CI; `npm ci` enforces the lockfile.

## Active Python code

The standalone crawler uses:

```powershell
python -m pip install -r scripts/requirements.txt
python scripts/cloud_crawler.py
```

Dagster dependencies are isolated in `data/dagster/requirements.txt` and are
installed by its Dockerfile. Static checks from the root:

```powershell
python -m compileall -q data/dagster scripts legacy/airflow/airflow
ruff check data/dagster scripts legacy/airflow/airflow
python -m unittest discover -s data/dagster/tests -p "test_*.py"
```

## Environment contract

| Variable                            | Consumer                 | Required condition                                                                                |
| ----------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                      | Web/cloud crawler/Prisma | Always outside Compose-generated web URL.                                                         |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Compose services         | Polaris business database.                                                                        |
| `DAGSTER_DB_NAME`                   | Dagster                  | Metadata database; local init default is `polaris_dagster`.                                       |
| `METABASE_DB_NAME`                  | Metabase                 | Application metadata database; local init default is `polaris_metabase`.                          |
| `REDIS_URL` or host/port/password   | Web                      | Optional for basic reads; required for digest lock.                                               |
| `REDIS_TLS_REJECT_UNAUTHORIZED`     | Web                      | Defaults true; false only for controlled development.                                             |
| `NEXT_PUBLIC_SITE_URL`              | Web links/origin         | Required in deployed environments.                                                                |
| `AUTH_SECRET`                       | NextAuth                 | Session signing.                                                                                  |
| `NEXT_PUBLIC_LOGIN_URL`             | Web menu                 | Optional login page override.                                                                     |
| `NEXT_PUBLIC_AUTH_ORIGIN`           | Central logout bridge    | Optional; only with an approved IdP.                                                              |
| `ALERT_TOKEN_SECRET`                | Unsubscribe HMAC         | Alert email flow.                                                                                 |
| `INTERNAL_DIGEST_TOKEN`             | Digest workflow/web      | Alert scheduler.                                                                                  |
| `INTERNAL_VECTORIZER_TOKEN`         | Dagster/web              | Vectorization asset.                                                                              |
| `SMTP_*`                            | Web email module         | Alert delivery.                                                                                   |
| `DISCORD_WEBHOOK_URL`               | Dagster/cloud crawler    | Optional notifications.                                                                           |
| `TRUST_PROXY_HEADERS`               | Rate limiting            | Enable only behind a trusted proxy; otherwise production requests share a strict fallback bucket. |
| `CUBEJS_API_SECRET`                 | Cube                     | Required outside isolated development.                                                            |
| `CUBEJS_DEV_MODE`                   | Cube                     | Keep false outside isolated development; Compose supplies a separate Cube Store.                  |

## Adding a crawler source

1. Add a source adapter under `data/dagster/crawl_pipeline/assets/ingestion/`.
2. Reuse `utils/http_client.py`, MinIO/PostgreSQL resources, and
   `utils/raw_jobs.py`.
3. Use a stable source-specific ID and set `source` explicitly.
4. Store raw inputs before parsing where possible.
5. Add selector fixtures/tests; do not silently invent missing business fields.
6. Run `dbt parse` if the source changes the dbt contract.

## Coding rules

- Preserve `raw_jobs` compatibility unless a migration and all consumers are
  updated together.
- Keep external input validation at route/adapter boundaries.
- Use parameterized SQL and bounded network calls.
- Do not swallow failures that would make an asset/workflow look successful.
- Mark unknown business behavior `NEEDS_CONFIRMATION`.
