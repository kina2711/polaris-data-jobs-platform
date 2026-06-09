# 🦅 Crawl Job Data Pipeline (MDS 2.0)

<div align="center">
  <!-- Core -->
  <img src="https://img.shields.io/badge/Next.js-15.0-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-Neon-blue?style=flat-square&logo=postgresql" alt="Neon Postgres" />
  <img src="https://img.shields.io/badge/Vector-pgvector-purple?style=flat-square" alt="pgvector" />
  <img src="https://img.shields.io/badge/AI-Sentence__Transformers-orange?style=flat-square&logo=huggingface" alt="HuggingFace" />
  <img src="https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?style=flat-square&logo=github-actions" alt="GitHub Actions" />
  
  <br />
  <!-- Local Flow 1 -->
  <img src="https://img.shields.io/badge/Orchestrator-Dagster-blue?style=flat-square" alt="Dagster" />
  <img src="https://img.shields.io/badge/Container-Docker-2496ED?style=flat-square&logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/Data_Lake-MinIO-red?style=flat-square" alt="MinIO" />
  <img src="https://img.shields.io/badge/Semantic_Layer-Cube.js-black?style=flat-square" alt="Cube.js" />
  <img src="https://img.shields.io/badge/BI-Metabase-509EE3?style=flat-square&logo=metabase" alt="Metabase" />
  <img src="https://img.shields.io/badge/Alert-Discord-5865F2?style=flat-square&logo=discord" alt="Discord" />
</div>

<br />

A completely automated, end-to-end Data Engineering & AI Platform that crawls IT
job postings, generates vector embeddings for Semantic Search (AI Match), and
presents them on a blazing-fast Next.js dashboard.

---

## 🏗 System Architectures

The system is designed with two distinct architectures, serving different
operational needs.

### 1. Local Architecture (Data Mesh with Dagster & Docker)

This is the foundational architecture built on the Data Mesh model, utilizing
Enterprise-standard tools. This architecture is suitable for deployment on a
Local Server or a personal machine for development and research.

**End-to-End Flow:**

```mermaid
graph TD
    %% Ingestion
    subgraph Ingestion [1. Ingestion]
        crawler[Web Crawler Scripts]
        minio[(MinIO Data Lake)]
    end
    crawler -- Raw HTML --> minio

    %% Transformation
    subgraph Transformation [2. Transformation]
        bs4[BeautifulSoup Parser]
        pg[(PostgreSQL Data Warehouse)]
    end
    minio -- Read HTML --> bs4
    bs4 -- Structured Data --> pg

    %% Vectorization
    subgraph Vectorization [3. AI Vectorization]
        hf[HuggingFace MiniLM]
        pgvector[(pgvector Embeddings)]
    end
    pg -- Fetch Jobs --> hf
    hf -- 384-dim Vectors --> pgvector

    %% Alerts & BI
    subgraph Serving [4. Serving & Alerts]
        discord[Discord Webhook]
        cube[Cube.js Semantic Layer]
        metabase[Metabase Dashboard]
    end
    pgvector -- Success Trigger --> discord
    pgvector -- Connect --> cube
    cube -- Query --> metabase

    %% Styling
    classDef storage fill:#f9f,stroke:#333,stroke-width:2px;
    class minio,pg,pgvector storage;
```

1. **Ingestion (Raw Data Crawling):**
   - Dagster runs crawl pipelines targeting job portals (TopCV, LinkedIn).
   - Raw HTML data is immediately ingested into **MinIO Object Storage** (Data
     Lake).
2. **Transformation (Data Parsing):**
   - Dagster reads the HTML back from MinIO, utilizing `BeautifulSoup` to parse
     specific fields (Title, Salary, Description, Requirements...).
   - The parsed data is loaded into the `raw_jobs` table in **PostgreSQL** (Data
     Warehouse).
3. **AI Vectorization (Semantic Vector Embedding):**
   - The `vectorized_jobs_ai` asset in Dagster reads from the `raw_jobs` table.
   - We utilize the HuggingFace `all-MiniLM-L6-v2` model to encode job
     descriptions into 384-dimensional vectors.
   - The database's `embedding` field is updated using the `vector(384)` type
     from the `pgvector` extension.
4. **Notification (Discord Alerts):**
   - Immediately after the vectorization pipeline finishes, Dagster triggers the
     `discord_notification_asset`.
   - A bot automatically aggregates the newly collected jobs and pushes a
     detailed alert (including Title, Company, Salary, Link) via Webhook to our
     **Discord** channel.
5. **Semantic Layer & BI (Data Discovery):**
   - **Cube.js** connects to PostgreSQL to define schemas and handle
     pre-aggregations (Semantic Layer).
   - **Metabase** visualizes this data into analytics dashboards.

### 📸 Local Architecture Screenshots

1. **Dagster Pipeline Graph**  
   ![Dagster Pipeline Graph](docs/dagster_graph.png)

2. **Discord Notification Alert**  
   ![Discord Notification Alert](docs/discord_alert.png)

3. **Metabase BI Dashboard**  
   ![Metabase BI Dashboard](docs/metabase_dashboard.png)

---

### 2. Serverless Automation Architecture (GitHub Actions)

To completely eliminate server hosting costs (Zero-cost), the system evolved
into a Cloud Automation model. This architecture is perfect for maintaining
daily Data Pipeline operations automatically and for free.

**End-to-End Flow:**

```mermaid
graph TD
    %% Automation
    subgraph Automation [1. Automation]
        cron[GitHub Actions Cronjob]
        runner[Ubuntu Cloud Runner]
    end
    cron -- Trigger Daily --> runner

    %% Processing
    subgraph Processing [2. Processing]
        crawler[Python Crawler]
        bs4[BeautifulSoup Parser]
        hf[HuggingFace Embedding]
    end
    runner -- Execute --> crawler
    crawler -- Scrape HTML --> bs4
    bs4 -- Clean Text --> hf

    %% Storage
    subgraph Storage [3. Cloud Storage]
        neon[(Neon.tech PostgreSQL)]
    end
    hf -- Direct Insert Data + Vectors --> neon

    %% Frontend
    subgraph Frontend [4. Real-Time Frontend]
        vercel[Next.js App on Vercel]
        prisma[Prisma ORM]
        ui[User Dashboard & AI Match]
    end
    neon -- Query --> prisma
    prisma -- Render --> ui
    vercel -- Connect --> neon

    %% Styling
    classDef storage fill:#f9f,stroke:#333,stroke-width:2px;
    class neon storage;
```

1. **Automated Trigger (Cronjob):**
   - **GitHub Actions** automatically triggers the `daily-crawl.yml` workflow at
     a fixed schedule (e.g., 00:00 AM daily).
2. **Cloud Crawling & Parsing:**
   - The GitHub Runner spins up a Python environment and executes the
     `cloud_crawler.py` script.
   - The script scrapes the HTML and parses the data directly in the runner's
     memory.
3. **On-the-fly AI Embedding:**
   - The script loads the `sentence-transformers` library and computes Cosine
     Vectors (Embeddings) locally on the GitHub Runner for new jobs.
4. **Cloud Database Insertion:**
   - Both textual data and vectors are pushed directly (Direct Insert) into the
     cloud-hosted **Neon.tech PostgreSQL** database.
5. **Real-time Frontend (Vercel):**
   - The **Next.js App Router** (hosted on Vercel) automatically connects to the
     Neon Database via Prisma ORM.
   - The website displays the latest job listings, utilizing Next.js API Routes
     to calculate Semantic Search scores using `pgvector` when users paste their
     CVs.

> **[CLOUD ARCHITECTURE SCREENSHOT PLACEHOLDERS]**
>
> _(Please replace the placeholders below with actual image links)_
>
> 1. Screenshot of a successful run history (Green Checks) on GitHub Actions:
>    `![GitHub Actions Run](docs/github_actions.png)`
> 2. Screenshot of the live Website (Next.js) demonstrating the AI Match
>    feature: `![Next.js Web Portal](docs/web_portal.png)`

---

## ✨ Key Features

- **🚀 Serverless Data Crawling**: Runs entirely on GitHub Actions via Cron Jobs
  without requiring a local machine.
- **🧠 AI Smart Match (Semantic Search)**: Instead of simple keyword matching,
  users can paste their entire CV. The system calculates the Cosine Similarity
  against all jobs using `pgvector` and HuggingFace embeddings.
- **📊 Native BI Dashboard**: Real-time analytics built from scratch using
  `recharts` and raw Prisma SQL queries, replacing heavy external BI tools.
- **⚡ Extreme Performance**: Leveraging Next.js Server Components, Prisma, and
  direct cloud database pooling.

---

## 🛠 Tech Stack

| Category             | Technology                                            |
| -------------------- | ----------------------------------------------------- |
| **Frontend**         | Next.js 15 (App Router), React, TailwindCSS, Recharts |
| **Backend/API**      | Next.js API Routes, Prisma ORM                        |
| **Database**         | Neon.tech (PostgreSQL 16) + `pgvector`                |
| **Data Engineering** | Python, BeautifulSoup, Pandas, SQLAlchemy             |
| **AI/ML**            | `sentence-transformers` (all-MiniLM-L6-v2)            |
| **Orchestration**    | GitHub Actions (Prod), Dagster (Local Legacy)         |
| **Deployment**       | Vercel                                                |

---

## 🚀 Getting Started

### 1. Prerequisites

- Node.js 18+
- Python 3.10+
- A [Neon.tech](https://neon.tech) PostgreSQL database (for Cloud setup)
- Docker Desktop (for Local setup)

### 2. Start the Frontend (Web Portal)

```bash
cd frontend
npm install
npx prisma db push
npm run dev
```

Visit `http://localhost:3400` to see the Job Board.

### 3. Run the Cloud Crawler Manually

```bash
pip install -r scripts/requirements.txt
python scripts/cloud_crawler.py
```

### 4. Run the Local Dagster Pipeline

```bash
docker compose up -d
```

Visit `http://localhost:3000` to open the Dagster Webserver.

---

## 🤝 Contributing

Feel free to open an issue or submit a pull request if you have ideas to improve
the matching algorithm or add more job sources!
