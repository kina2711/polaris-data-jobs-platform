# Database

## Canonical engine

The active platform uses PostgreSQL with pgvector. MySQL references belonged to
removed web code and must not be reintroduced into active configuration.

Sources of schema truth:

- `data/postgres/init/001_polaris.sql` for fresh local Compose volumes.
- `apps/web/prisma/schema.prisma` for application models.
- `apps/web/prisma/migrations/` for existing database rollout.
- `data/dagster/crawl_pipeline/utils/raw_jobs.py` for crawler-compatible
  `raw_jobs` creation/upsert.

Dagster and Metabase metadata live in separate `polaris_dagster` and
`polaris_metabase` databases. They are not part of the Polaris business schema.

## Tables

### `raw_jobs`

| Column                                                 | Type        | Notes                                                       |
| ------------------------------------------------------ | ----------- | ----------------------------------------------------------- |
| `id`                                                   | varchar PK  | Stable source job ID.                                       |
| `title`, `company`, `location`, `salary`, `experience` | varchar     | Source text; nullable.                                      |
| `description`, `requirements`                          | text        | Parsed source content.                                      |
| `tags`, `source`, `url`                                | varchar     | Source metadata.                                            |
| `crawled_at`                                           | timestamp   | First-seen ingestion timestamp; active upserts preserve it. |
| `embedding`                                            | vector(384) | Normalized MiniLM vector; nullable until enriched.          |

Indexes cover source, company lookup, and newest crawl time. Vector search is
currently exact; adding an approximate pgvector index requires measured data
volume/recall and is `NEEDS_CONFIRMATION`.

### `User`

Reference rows used for alert ownership and email addressing. The web app does
not provision users. Ownership is `NEEDS_CONFIRMATION` pending the Polaris IdP.

### `JobAlert`

Stores sanitized JSON filters, timezone, daily schedule fields, active state,
`lastSentAt`, and `lastDeliveredJobAt`. The delivery cursor prevents permanent
loss when more matches exist than fit one email.

### `JobAlertDelivery`

Append-only audit containing alert ID, send time, job ID JSON, and optional SMTP
provider message ID.

## Derived dbt objects

- `stg_jobs`: selected/renamed raw fields.
- `dim_jobs_clean`: normalized locations, basic salary extraction, and coarse
  experience levels.

These are rebuildable outputs, not alternate sources of truth.

## Migration workflow

For a fresh Compose volume, first register the historical empty baseline:

```powershell
docker compose exec -T web npx prisma migrate resolve --applied 20260422140000_jobs_baseline
docker compose exec -T web npx prisma migrate deploy
```

For an existing initialized database:

```powershell
Set-Location apps/web
npm ci
npm run db:validate
npx prisma migrate deploy
```

For a new reviewed migration during development:

```powershell
npx prisma migrate dev --name descriptive_change
```

Do not edit an already applied migration. The original empty migration retains
historical comments for checksum/provenance; the Polaris alignment migration is
the additive active schema migration.

## Consistency rules

- Change `raw_jobs` only with a coordinated update to Dagster, cloud crawler,
  Prisma, dbt, Cube, web queries, init SQL, and documentation.
- Preserve embeddings when non-semantic metadata changes. Set the embedding to
  `NULL` when title, experience, description, or requirements change so the
  vectorizer recomputes it.
- Preserve the first non-null `crawled_at` value during Dagster upserts so old
  jobs do not become new alert candidates after every recrawl.
- Use transactions for batch persistence and parameterized SQL for values.
- Do not save new cloud-crawler rows with `NULL` embeddings after a model error.
- Treat generated dbt target files and database volumes as disposable artifacts.

The `crawl_jobs_db` database name and `crawl_dbt` profile are retained technical
compatibility identifiers. The official domain and product identity is Polaris;
renaming persisted database/profile contracts requires a separate migration.

## Backup and recovery

No backup automation is defined in this repository. Production backup,
retention, point-in-time recovery, and restore drills are `NEEDS_CONFIRMATION`
and must be supplied by the deployment environment.
