
  create view "crawl_jobs_db"."public"."stg_jobs__dbt_tmp"
    
    
  as (
    -- models/staging/stg_jobs.sql
WITH source AS (
    SELECT * FROM "crawl_jobs_db"."public"."raw_jobs"
)

SELECT
    id,
    title,
    company,
    location,
    salary AS raw_salary,
    experience AS raw_experience,
    source,
    crawled_at
FROM source
  );