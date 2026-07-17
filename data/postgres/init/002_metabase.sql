-- Platform services own their application metadata and migrations. Keep them
-- isolated from the Polaris business schema in crawl_jobs_db.
SELECT 'CREATE DATABASE polaris_metabase'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'polaris_metabase'
)\gexec

SELECT 'CREATE DATABASE polaris_dagster'
WHERE NOT EXISTS (
    SELECT FROM pg_database WHERE datname = 'polaris_dagster'
)\gexec
