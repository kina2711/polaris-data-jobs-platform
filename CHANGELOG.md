# Changelog

All notable repository changes are documented here. The project does not yet
publish tagged releases, so dates identify reviewed change sets.

## Unreleased

### Changed

- Standardized the official product/domain identity as Polaris.
- Replaced stale product names in web metadata, Open Graph cards, and page
  descriptions while retaining existing database/profile identifiers for
  compatibility.
- Made PostgreSQL `raw_jobs` the canonical web, crawler, dbt, Cube, and alert
  data source; removed active MySQL coupling.
- Made Dagster ingestion use atomic batch upserts and fail on vectorization or
  configured notification errors.
- Secured internal vectorization with a separate Bearer token and shell-free
  process execution.
- Added alert delivery cursors, the hourly digest workflow, stronger request
  validation, rate limiting, and visible alert action errors.
- Prevented unsupported category/level alert definitions, normalized common
  location and salary formats, unified salary parsing across alerts, dashboard,
  and JSON-LD, and kept direct Compose traffic in a strict shared rate-limit
  bucket when no trusted proxy IP is available.
- Made the digest explicitly skip and log legacy alert filters that the
  canonical `raw_jobs` schema cannot evaluate, and documented dashboard USD
  conversion as a display-only heuristic.
- Corrected dashboard trend/company metrics and homepage request races/counts.
- Hardened Redis TLS defaults and restored Cube built-in authentication.
- Added the required Cube Store service, isolated Dagster and Metabase metadata
  databases, and made Dagster load its committed PostgreSQL instance config.
- Made container Redis clients connect eagerly, supplied Dagster MinIO
  credentials, created MinIO buckets lazily, and installed OpenSSL in the web
  runtime image for Prisma compatibility.
- Reworked the cloud crawler to filter before capping, require successful
  embeddings, parameterize vectors, backfill missing vectors, and bound webhook
  calls.
- Preserved first-seen crawl timestamps during Dagster upserts, invalidated
  stale embeddings after semantic text changes, and reported/notified only rows
  actually inserted by the cloud crawler.
- Added web unit tests and CI quality gates.
- Replaced stale setup/domain documentation with verified Polaris architecture,
  flow, development, deployment, API, and database guides.
- Reframed the root README as a verified data story and integrated the existing
  repository screenshots without replacing the original assets.
- Standardized the complete root README in English and added a technology icon
  strip above the project narrative.
- Added a root MIT license and documented its scope relative to third-party
  content and the separately licensed legacy subtree.
- Replaced the compact architecture diagram with verified, numbered end-to-end
  flows for the local Dagster stack and GitHub Actions automation.
- Moved the Discord smoke script to `experiments/manual/` and removed the
  committed credential from source.

### Fixed (legacy)

- Mark only successfully delivered Discord job URLs as posted.
- Correct percentage formulas, posted-row counting, and active-day date order in
  archived dbt models.

### Security action required

- A Discord webhook had been committed historically. The source copy is removed,
  but repository administrators must revoke/rotate that credential and consider
  history cleanup according to their incident process.
