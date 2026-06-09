-- models/staging/stg_jobs.sql
WITH source AS (
    SELECT * FROM {{ source('public', 'raw_jobs') }}
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
