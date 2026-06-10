# 🚀 Setup & Local Deployment Guide (Docker Architecture)

The Data Pipeline system is designed with a Data Lake (MinIO), an Asset-based Orchestrator (Dagster), a Semantic Layer (Cube.js), and a Vector Database (pgvector) combined with AI Embeddings.

> **Note**: This is the Local Docker architecture intended for development and reference. The current Production architecture uses GitHub Actions + Neon.tech + Vercel (see README.md).

---

## Step 1: Start the Ecosystem (Docker)

The system requires **Docker Desktop**.

1. Ensure ports `5432`, `6379`, `9000`, `9001`, `3000`, `3001`, `3400`, and `4000` are available.
2. Open your Terminal, navigate to the project directory, and run:
   ```bash
   docker compose up -d --build
   ```
3. Wait for about 1-2 minutes for all services to finish initializing.

---

## Step 2: Crawl and Extract Data (Dagster)

1. Open your browser: **http://localhost:3000** (Dagster Webserver).
2. On the left navigation menu, select **Assets**.
3. Click **"Materialize All"** in the top right corner to trigger the Assets:
   - Data Ingestion: Crawls job data from LinkedIn, TopCV, and ITViec.
   - Transformation (DBT): Cleans and models the data.
   - AI Vectorization: Creates embeddings for the jobs.
4. (Optional) Check the raw HTML at the MinIO Data Lake (**http://localhost:9001** - `admin` / `password`).

---

## Step 3: Explore Data with Semantic Layer & BI

1. **Cube.js (http://localhost:4000)**: The Semantic Layer for the entire system.
2. **Metabase (http://localhost:3001)**: Visualize charts and dashboards. Connect to the database `crawl_jobs_db` (Host: `postgresql_db`, User/Pass: `postgres`).

---

## Step 4: Experience the Web Portal

1. Access: **http://localhost:3400**
2. **Smart Match** Feature: Paste your CV, and the system will find the most suitable jobs using `pgvector` cosine similarity.

---

💡 **Troubleshooting:**

- `docker compose ps` to check running services.
- `docker compose down` to stop the ecosystem.
- `docker compose down -v` to completely wipe all data and start fresh.
