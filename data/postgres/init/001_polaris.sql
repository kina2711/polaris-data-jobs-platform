CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS raw_jobs (
    id TEXT PRIMARY KEY,
    title TEXT,
    company TEXT,
    location TEXT,
    salary TEXT,
    experience TEXT,
    description TEXT,
    requirements TEXT,
    tags TEXT,
    source TEXT,
    url TEXT,
    crawled_at TIMESTAMP(3),
    embedding vector(384)
);

CREATE INDEX IF NOT EXISTS raw_jobs_crawled_at_idx
    ON raw_jobs (crawled_at DESC);
CREATE INDEX IF NOT EXISTS raw_jobs_company_idx
    ON raw_jobs (company);
CREATE INDEX IF NOT EXISTS raw_jobs_source_idx
    ON raw_jobs (source);

CREATE TABLE IF NOT EXISTS "User" (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT NOT NULL UNIQUE,
    "emailVerified" TIMESTAMP(3),
    image TEXT,
    role TEXT NOT NULL DEFAULT 'student',
    "isBlocked" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "JobAlert" (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    name VARCHAR(120) NOT NULL,
    filters JSONB NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'daily',
    "sendHour" INTEGER NOT NULL DEFAULT 8,
    weekday INTEGER,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    "lastSentAt" TIMESTAMP(3),
    "lastDeliveredJobAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "JobAlert"
    ADD COLUMN IF NOT EXISTS "lastDeliveredJobAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "JobAlert_userId_idx" ON "JobAlert" ("userId");
CREATE INDEX IF NOT EXISTS "JobAlert_active_frequency_idx"
    ON "JobAlert" (active, frequency);

CREATE TABLE IF NOT EXISTS "JobAlertDelivery" (
    id TEXT PRIMARY KEY,
    "alertId" TEXT NOT NULL REFERENCES "JobAlert"(id) ON DELETE CASCADE ON UPDATE CASCADE,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobIds" JSONB NOT NULL,
    "providerId" VARCHAR(200)
);

CREATE INDEX IF NOT EXISTS "JobAlertDelivery_alertId_sentAt_idx"
    ON "JobAlertDelivery" ("alertId", "sentAt");
