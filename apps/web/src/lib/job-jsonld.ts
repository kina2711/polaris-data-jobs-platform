import type { Job } from './types';

interface ParsedSalary {
  currency: 'VND' | 'USD';
  min?: number;
  max?: number;
  value?: number;
}

// Salary crawl là free-text VN ("10 - 20 triệu", "Tới 30 triệu", "Từ 1,000 USD",
// "Thoả thuận"...). Trả null khi không suy ra được số để BỎ baseSalary thay vì
// bịa — chỉ "triệu" (VND) và "USD" mới parse, khớp đúng pattern trong api.ts.
export function parseSalary(
  raw: string | null | undefined,
): ParsedSalary | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const isUsd = /usd|\$/.test(s);
  const isVndMillions = /tri[eệ]u/.test(s);
  if (!isUsd && !isVndMillions) return null;
  const nums = (s.match(/\d[\d.,]*/g) ?? [])
    .map((n) => parseFloat(n.replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length === 0) return null;
  const mult = isVndMillions ? 1_000_000 : 1;
  const scaled = nums.map((n) => Math.round(n * mult));
  const currency = isUsd ? 'USD' : 'VND';
  if (scaled.length >= 2) {
    return { currency, min: Math.min(...scaled), max: Math.max(...scaled) };
  }
  const v = scaled[0];
  if (/t[ớơ]i|đ[eế]n|under|up to|tối đa/.test(s)) return { currency, max: v };
  if (/t[ừu]\s|\bfrom\b|tr[eê]n|tối thiểu|starting/.test(s))
    return { currency, min: v };
  return { currency, value: v };
}

// Map experience free-text VN → số tháng cho OccupationalExperienceRequirements.
// Google coi experienceRequirements dạng chuỗi tự do là "invalid enum"; phải là
// object monthsOfExperience (số) hoặc bỏ hẳn.
export function parseExperienceMonths(
  raw: string | null | undefined,
): number | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (!s) return null;
  if (/không|chưa|fresher|intern|thực tập|no exp|0\s*năm/.test(s)) return 0;
  const year = s.match(/(\d+)\s*\+?\s*(năm|nam|year|yr)/);
  if (year) return parseInt(year[1], 10) * 12;
  const month = s.match(/(\d+)\s*(tháng|thang|month|mo)\b/);
  if (month) return parseInt(month[1], 10);
  return null;
}

// Google employmentType chỉ nhận enum cố định (FULL_TIME/PART_TIME/INTERN/
// CONTRACTOR/...). Crawl chỉ có `level` (junior/senior — seniority, không phải
// loại hình) → emit thẳng `level` gây "Invalid value". Suy ra enum CHỈ từ
// TITLE: description quá nhiễu (job full-time hay nhắc "thực tập"/"hợp đồng"/
// "fresher" trong mô tả → gán sai INTERN/CONTRACTOR). Mặc định FULL_TIME.
function inferEmploymentType(job: Job): string {
  const s = (job.title ?? '').toLowerCase();
  if (/intern|thực tập|thuc tap/.test(s)) return 'INTERN';
  if (/part[\s-]?time|bán thời gian|ban thoi gian/.test(s)) return 'PART_TIME';
  if (/\bcontract\b|freelance|cộng tác viên|\bctv\b/.test(s))
    return 'CONTRACTOR';
  return 'FULL_TIME';
}

function toIso(d: string | null | undefined): string | undefined {
  if (!d) return undefined;
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

// Trang job 404 khi last_seen_at < now-14d (xem fetchJobById). validThrough =
// last_seen_at + 14d phản ánh đúng thời điểm posting hết hiệu lực trên site.
function computeValidThrough(job: Job): string | undefined {
  const base = job.last_seen_at ?? job.job_posted_date ?? job.created_at;
  if (!base) return undefined;
  const t = new Date(base).getTime();
  if (Number.isNaN(t)) return undefined;
  return new Date(t + 14 * 86_400_000).toISOString();
}

// Schema.org JobPosting JSON-LD cho rich result. Bỏ qua field undefined ở khâu
// serialize (replacer trong page). streetAddress/postalCode không có trong data
// crawl (chỉ có tên thành phố) nên KHÔNG emit — không bịa địa chỉ giả (GSC chỉ
// cảnh báo "Improve item appearance", item vẫn hợp lệ). addressRegion thì emit
// được vì location crawl ở cấp tỉnh/thành.
export function buildJobPostingLd(
  job: Job,
  description: string,
  canonicalUrl: string,
): Record<string, unknown> {
  const salary = parseSalary(job.salary);
  const months = parseExperienceMonths(job.experience);

  const baseSalary = salary
    ? {
        '@type': 'MonetaryAmount',
        currency: salary.currency,
        value: {
          '@type': 'QuantitativeValue',
          ...(salary.value != null ? { value: salary.value } : {}),
          ...(salary.min != null ? { minValue: salary.min } : {}),
          ...(salary.max != null ? { maxValue: salary.max } : {}),
          unitText: 'MONTH',
        },
      }
    : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: description || job.title,
    datePosted: toIso(job.job_posted_date ?? job.created_at),
    validThrough: computeValidThrough(job),
    hiringOrganization: job.company
      ? { '@type': 'Organization', name: job.company }
      : undefined,
    jobLocation: job.location
      ? {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            // Crawl chỉ có 1 trường location ở cấp tỉnh/thành (Hà Nội, TP.HCM,
            // Đà Nẵng... đều là thành phố trực thuộc TW → vừa locality vừa
            // region). Emit cả addressRegion để gỡ warning GSC "Missing field
            // addressRegion" mà không bịa cấp địa chỉ ta không có.
            addressLocality: job.location,
            addressRegion: job.location,
            addressCountry: 'VN',
          },
        }
      : undefined,
    employmentType: inferEmploymentType(job),
    experienceRequirements:
      months != null
        ? {
            '@type': 'OccupationalExperienceRequirements',
            monthsOfExperience: months,
          }
        : undefined,
    baseSalary,
    directApply: false,
    url: canonicalUrl,
  };
}

// Serialize JSON-LD để nhúng an toàn vào <script> qua dangerouslySetInnerHTML.
// `description` chứa raw HTML crawl (<div>, <strong>, <ul>...); nếu một job có
// chuỗi "</script>" trong mô tả thì HTML parser đóng <script> sớm → vỡ toàn bộ
// JSON-LD page đó (GSC "Unparsable structured data"). Escape <, >, & và
// U+2028/U+2029 (line separator hợp lệ trong JSON nhưng phá JS) sang \uXXXX —
// JSON.parse vẫn decode về ký tự gốc, nhưng HTML parser không còn thấy "<".
export function serializeJsonLd(ld: Record<string, unknown>): string {
  return JSON.stringify(ld, (_k, v) => (v === undefined ? undefined : v))
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
