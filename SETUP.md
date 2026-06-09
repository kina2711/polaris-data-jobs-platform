# 🚀 Hướng dẫn Cài đặt & Khởi chạy Local (Docker Architecture)

Hệ thống Data Pipeline được thiết kế với Data Lake (MinIO), Asset-based
Orchestrator (Dagster), Semantic Layer (Cube.js) và Vector Database (pgvector)
kết hợp cùng AI Embeddings.

> **Lưu ý**: Đây là kiến trúc Local Docker dùng cho phát triển/tham khảo. Kiến
> trúc Production hiện tại sử dụng GitHub Actions + Neon.tech + Vercel (xem
> README.md).

---

## Bước 1: Khởi động Hệ sinh thái (Docker)

Hệ thống yêu cầu **Docker Desktop**.

1. Đảm bảo các port `5432`, `6379`, `9000`, `9001`, `3000`, `3001`, `3400`,
   `4000` đang trống.
2. Mở Terminal, di chuyển vào thư mục project và chạy:
   ```bash
   docker compose up -d
   ```
3. Đợi khoảng 1-2 phút cho các dịch vụ khởi động hoàn tất.

---

## Bước 2: Cào và Bóc tách Dữ liệu (Dagster)

1. Mở trình duyệt: **http://localhost:3000** (Dagster Webserver).
2. Ở menu bên trái, chọn **Assets**.
3. Bấm **"Materialize All"** ở góc phải để kích hoạt các Asset:
   - `topcv_search_pages_html`: Cào danh sách trang.
   - `topcv_job_details_html`: Cào chi tiết Job lưu vào MinIO.
   - `parsed_jobs_postgresql`: Dùng BeautifulSoup bóc tách thông tin và đẩy vào
     PostgreSQL (`raw_jobs`).
4. (Tuỳ chọn) Kiểm tra HTML thô tại Data Lake MinIO (**http://localhost:9001** -
   `admin` / `password`).

---

## Bước 3: Kích hoạt AI Vectorization

Để sử dụng tính năng "Smart Match" (Tìm việc bằng AI Semantic Search):

1. Mở Terminal, di chuyển vào thư mục Web:
   ```bash
   cd web
   npm install
   node scripts/vectorize.js
   ```
   _Quá trình này sử dụng AI Model `@xenova/transformers` (chạy offline, không
   tốn API) để mã hóa Job thành Vector 384 chiều._

---

## Bước 4: Khám phá Dữ liệu với Semantic Layer & BI

1. **Cube.js (http://localhost:4000)**: Semantic Layer cho toàn bộ hệ thống.
2. **Metabase (http://localhost:3001)**: Vẽ biểu đồ trực quan. Kết nối tới
   Database `crawl_jobs_db` (Host: `postgresql_db`, User/Pass: `postgres`).

---

## Bước 5: Trải nghiệm Web Portal

1. Truy cập: **http://localhost:3400**
2. Chức năng **Smart Match**: Dán CV vào, hệ thống sẽ tìm Job khớp nhất bằng
   `pgvector` cosine similarity.

---

💡 **Troubleshooting:**

- `docker compose ps` để kiểm tra service.
- `docker compose down` để tắt.
- `docker compose down -v` để xóa sạch data.
