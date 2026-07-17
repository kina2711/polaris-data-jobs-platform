# API contract

All routes are Next.js App Router handlers under `apps/web/src/app/api/`.
Examples omit the origin (`http://localhost:3400` in local development).

## Public routes

### `GET /api/health`

Returns database and Redis reachability.

```json
{
  "status": "ok",
  "checks": { "db": true, "redis": true },
  "timestamp": "2026-07-15T00:00:00.000Z"
}
```

Status is `200` when PostgreSQL works and `503` otherwise. Redis is optional for
basic reads but required by alert locking and improves caching/rate limiting.

### `POST /api/match`

Body:

```json
{
  "cvText": "optional CV plain text",
  "keyword": "data engineer",
  "location": "hà nội",
  "source": "topcv",
  "page": 1
}
```

- `source`: `all`, `topcv`, `linkedin`, or `itviec`.
- `location`: `all`, `hà nội`, `hồ chí minh`, or another value treated by the UI
  as the other-region branch.
- `cvText` empty: newest rows first. Non-empty: pgvector similarity first.
- Success: `{ jobs, page, limit: 20, total }`.
- Job IDs are strings. Fields absent from `raw_jobs` are returned as `null`.
- Errors: `400 invalid_body|invalid_filters`, `413 payload_too_large`,
  `429 rate_limited`, `500 internal_server_error`.

The route is limited to 30 requests/minute per resolved client bucket.

### `GET /api/dashboard/stats`

Returns:

```text
totalJobs, totalCompanies, jobsBySource, jobsByLocation,
topCompanies, trends, salaryDistribution
```

`trends` is the latest 14 available crawl dates in ascending display order.
Salary buckets are heuristic text parsing and not an authoritative payroll
calculation.

### `GET /api/account/status`

Returns a normalized authenticated/anonymous session status. Authentication
providers are currently `NOT_IMPLEMENTED`.

## Session-protected alert routes

Alert writes also require a same-origin request.

### `GET /api/alerts`

Returns the current user's alerts or `401`.

### `POST /api/alerts`

Body:

```json
{
  "name": "Senior Data roles",
  "timezone": "Asia/Ho_Chi_Minh",
  "filters": {
    "keyword": "data",
    "location": "Hà Nội",
    "salary": "20to30"
  }
}
```

At least one supported filter is required. A user may create at most five
alerts; quota is enforced in a serializable transaction. Supported alert filters
are `keyword`, `location`, and `salary`. Non-empty `category`, `role`,
`experience`, or `level` values return `400 unsupported_filters` because those
fields are absent from `raw_jobs`. Success is `201`.

### `PATCH /api/alerts/:id`

Accepts one or more of `active` (boolean), non-empty `name` (maximum 120), and a
valid `timezone`. Requires ownership.

### `DELETE /api/alerts/:id`

Deletes an owned alert and cascades its delivery rows.

## Unsubscribe

### `GET /api/unsubscribe?token=...`

Verifies the HMAC token, disables the alert when valid, and always returns
`{ "data": { "ok": true } }` to avoid exposing token validity. Human-facing
email links use `/unsubscribe?token=...`, whose page calls this API.

### `POST /api/unsubscribe?token=...`

Implements one-click unsubscribe for email clients. Tokens use the independent
`ALERT_TOKEN_SECRET` and expire after 90 days.

## Internal routes

### `POST /api/vectorize`

Header: `Authorization: Bearer <INTERNAL_VECTORIZER_TOKEN>`.

Runs `node scripts/vectorize.js` through `execFile` with a five-minute timeout.
The script processes at most 500 jobs missing embeddings. Success includes
`updated` and `failed`; any per-job failure makes the call fail with `500`.

### `POST /api/internal/digest`

Header: `Authorization: Bearer <INTERNAL_DIGEST_TOKEN>`.

Acquires a Redis hourly lock, evaluates due alerts, sends SMTP digests, and
returns:

Legacy alert rows with non-empty category, role, experience, or level filters
are skipped with a server-side warning because `raw_jobs` cannot evaluate those
fields. They must be recreated with supported filters.

```json
{
  "data": {
    "alertsProcessed": 1,
    "alertsWithMatches": 1,
    "emailsSent": 1,
    "emailsFailed": 0,
    "jobsScanned": 20
  }
}
```

Missing/mismatched token returns `500 server_misconfigured` or `401`. Lock or
Redis failure returns `503 lock_unavailable`.

## Authentication routes

`/api/auth/*` is registered by NextAuth, but `providers: []`. Provider-specific
login/callback behavior is therefore `NOT_IMPLEMENTED` pending the Polaris IdP
contract.
