WITH stg_jobs AS (
    SELECT * FROM "crawl_jobs_db"."public"."stg_jobs"
),

cleaned_jobs AS (
    SELECT
        id,
        title,
        company,
        
        -- Dọn dẹp Location
        CASE
            WHEN location ILIKE '%Hà Nội%' OR location ILIKE '%Hanoi%' THEN 'Hà Nội'
            WHEN location ILIKE '%Hồ Chí Minh%' OR location ILIKE '%Ho Chi Minh%' OR location ILIKE '%District 9%' THEN 'Hồ Chí Minh'
            WHEN location ILIKE '%Đà Nẵng%' OR location ILIKE '%Da Nang%' OR location ILIKE '%Đà Nang%' THEN 'Đà Nẵng'
            WHEN location ILIKE '%Hải Phòng%' OR location ILIKE '%Hai Phong%' THEN 'Hải Phòng'
            WHEN location ILIKE '%Cần Thơ%' OR location ILIKE '%Can Tho%' THEN 'Cần Thơ'
            ELSE 'Khác'
        END AS location_clean,
        location AS location_raw,

        -- Dọn dẹp mức lương (Extract numbers roughly)
        -- Ví dụ "10 - 20 triệu" -> min: 10, max: 20
        raw_salary,
        CASE
            WHEN raw_salary ILIKE '%Thoả thuận%' OR raw_salary ILIKE '%Thương lượng%' THEN 'Thoả thuận'
            WHEN raw_salary ILIKE '%Tới%' OR raw_salary ILIKE '%Up to%' THEN 'Lên đến'
            WHEN raw_salary ILIKE '%Từ%' THEN 'Từ'
            WHEN raw_salary ILIKE '%-%' THEN 'Khoảng'
            ELSE 'Khác'
        END AS salary_type,

        -- Tính số tiền cụ thể (Rất cơ bản, có thể cải tiến regex sau)
        -- Sử dụng NULLIF để tránh lỗi chia 0 nếu rỗng
        COALESCE(
            NULLIF(regexp_replace(raw_salary, '[^0-9]', '', 'g'), ''),
            '0'
        )::NUMERIC AS salary_numeric_extract,

        raw_experience,
        CASE 
            WHEN raw_experience ILIKE '%Không yêu cầu%' OR raw_experience ILIKE '%Dưới 1 năm%' THEN 'Fresher / Junior'
            WHEN raw_experience ILIKE '%1 năm%' OR raw_experience ILIKE '%2 năm%' OR raw_experience ILIKE '%3 năm%' THEN 'Mid-level'
            WHEN raw_experience ILIKE '%4 năm%' OR raw_experience ILIKE '%5 năm%' OR raw_experience ILIKE '%Trên 5 năm%' THEN 'Senior'
            ELSE 'Chưa xác định'
        END as experience_level,

        source,
        crawled_at
    FROM stg_jobs
)

SELECT * FROM cleaned_jobs