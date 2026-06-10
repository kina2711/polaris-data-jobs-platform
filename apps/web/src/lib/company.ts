import type { Job } from './types';

export interface CompanyDirectoryEntry {
  company: string;
  slug: string;
  jobCount: number;
  logoUrl: string | null;
  // ISO 8601 of the most recent posting — used for sitemap lastModified.
  latest: string;
}

export interface CompanyFacet {
  value: string;
  count: number;
}

export interface CompanyFacets {
  locations: CompanyFacet[];
  categories: CompanyFacet[];
  levels: CompanyFacet[];
  salaryRange: string | null;
}

export interface CompanyDetail {
  company: string;
  slug: string;
  jobCount: number;
  logoUrl: string | null;
  jobs: Job[];
  facets: CompanyFacets;
}

// `company` is free-text (no canonical id), so the slug is lossy and resolved
// back to a name via the cached directory (see resolveCompanyBySlug). Strips
// Vietnamese diacritics + đ so names round-trip to clean ASCII slugs:
// "MoMo (M_Service)" -> "momo-m-service", "Techcombank (TCB)" -> "techcombank-tcb".
export function slugifyCompany(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
