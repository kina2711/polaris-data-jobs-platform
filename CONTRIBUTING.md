# Contributing to Polaris

## Before changing code

1. Read the root README and the relevant flow in `docs/code-flow.md`.
2. Trace the real caller, data source, schema, and side effects.
3. Mark unknown business behavior `NEEDS_CONFIRMATION`; do not invent it.
4. Keep changes small enough to review and roll back.

## Development expectations

- Use Node.js 20 and `npm ci` for the web application.
- Keep PostgreSQL/pgvector as the active canonical data contract.
- Validate all external input and use parameterized SQL.
- Bound HTTP calls with timeouts/retries and preserve useful error context.
- Do not convert a failed operation into successful materialization metadata.
- Add tests for business logic, validation, security boundaries, or corrected
  regressions.
- Do not commit generated runtime data, caches, logs, secrets, or real webhook
  URLs.
- Do not modify `legacy/airflow/` as though it were active without an explicit
  migration decision.

## Required checks

```powershell
Set-Location apps/web
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
Set-Location ../..
python -m compileall -q data/dagster scripts legacy/airflow/airflow
ruff check data/dagster scripts legacy/airflow/airflow
docker compose config --quiet
```

If an external dependency, credential, or service prevents a check, record the
exact command and limitation. Do not report it as passed.

## Schema and API changes

- Include an additive Prisma migration and update init SQL.
- Update every producer/consumer named in `docs/database.md`.
- Preserve public contracts when possible. If a break is required, document the
  old/new contract and rollout order.
- Never use `prisma db push` for shared or production databases.

## Documentation

Update README/docs and `CHANGELOG.md` in the same change. Commands and endpoints
must be executable/present in the repository. Use `TODO`, `NEEDS_CONFIRMATION`,
or `NOT_IMPLEMENTED` for unverified behavior.
