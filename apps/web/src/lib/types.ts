export interface Job {
  id: string;
  title: string;
  company: string;
  url: string;
  location: string | null;
  salary: string | null;
  logo_url: string | null;
  source: string;
  category: string | null;
  experience: string | null;
  level: string | null;
  description: string | null;
  requirements?: string | null;
  job_posted_date: string | null;
  posted_to_discord: number;
  created_at: string;
  posted_at: string | null;
  last_seen_at: string | null;
  similarity?: number;
}

export interface JobsResponse {
  jobs: Job[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Stats {
  total: number;
  companies: number;
}

export type JobSource = 'topcv' | 'linkedin' | 'itviec' | 'all';
