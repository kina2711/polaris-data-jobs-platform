import nodemailer from 'nodemailer';
import type { Job } from './types';
import { SITE_URL } from './site-url';
const FROM = process.env.SMTP_FROM || 'Polaris Jobs <noreply@localhost>';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    const host = process.env.SMTP_HOST;
    if (!host) {
      throw new Error('[email] SMTP_HOST not configured');
    }
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
  }
  return transporter;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Nhiều email client (Gmail, Outlook) chặn http image hoặc data-URI; chỉ serve
// https để tránh broken-image icon.
function safeHttpsLogo(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function logoInitial(company: string): string {
  const parts = company.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

const LOGO_PALETTE = [
  '#fee2e2',
  '#fef3c7',
  '#dcfce7',
  '#dbeafe',
  '#e0e7ff',
  '#fae8ff',
  '#ffe4e6',
  '#ccfbf1',
];

function logoBgColor(company: string): string {
  let h = 0;
  for (let i = 0; i < company.length; i++) {
    h = (h * 31 + company.charCodeAt(i)) | 0;
  }
  return LOGO_PALETTE[Math.abs(h) % LOGO_PALETTE.length];
}

function renderLogoCell(job: Job): string {
  const size = 48;
  const safe = safeHttpsLogo(job.logo_url);
  const altText = escapeHtml(job.company || 'Company');
  if (safe) {
    return `<img src="${escapeHtml(safe)}" alt="${altText}" width="${size}" height="${size}" style="display:block; border-radius:8px; border:1px solid #eef2f5; object-fit:contain; background:#fff;" />`;
  }
  const initial = escapeHtml(logoInitial(job.company || '?'));
  const bg = logoBgColor(job.company || '');
  return `<div aria-hidden="true" style="width:${size}px; height:${size}px; border-radius:8px; background:${bg}; color:#0f172a; font-family:'Segoe UI',-apple-system,sans-serif; font-weight:700; font-size:16px; line-height:${size}px; text-align:center;">${initial}</div>`;
}

function formatRelativeVi(raw: string | null): string {
  if (!raw) return '';
  const then = new Date(raw).getTime();
  if (!Number.isFinite(then)) return '';
  const diffMs = Date.now() - then;
  if (diffMs < 0) return 'vừa đăng';
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return 'vừa đăng';
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 ngày trước';
  if (days < 7) return `${days} ngày trước`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? '1 tuần trước' : `${weeks} tuần trước`;
}

const SOURCE_LABELS: Record<string, string> = {
  topcv: 'TopCV',
  linkedin: 'LinkedIn',
  itviec: 'ITViec',
};

function renderSourceBadge(source: string): string {
  const label = SOURCE_LABELS[source] ?? source;
  return `<span style="display:inline-block; margin-left:6px; padding:1px 7px; font-size:11px; line-height:16px; border-radius:4px; background:#f1f5f9; color:#475569; font-weight:500;">${escapeHtml(label)}</span>`;
}

function renderJobRow(job: Job): string {
  const title = escapeHtml(job.title);
  const company = job.company ? escapeHtml(job.company) : '';
  const salary = job.salary ? escapeHtml(job.salary) : 'Thỏa thuận';
  const location = job.location ? escapeHtml(job.location) : '';
  const posted = formatRelativeVi(job.job_posted_date || job.created_at);
  const metaParts = [salary, location, posted].filter(Boolean).join(' · ');
  const link = `${SITE_URL}/jobs/${encodeURIComponent(job.id)}`;
  const logoCell = renderLogoCell(job);
  const badge = job.source ? renderSourceBadge(job.source) : '';
  return `
    <tr>
      <td style="padding:14px 0; border-bottom:1px solid #eef2f5;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse; width:100%;">
          <tr>
            <td valign="top" width="48" style="width:48px; padding-right:12px;">${logoCell}</td>
            <td valign="top" style="vertical-align:top;">
              <a href="${link}" style="color:#0f172a; font-size:15px; font-weight:600; text-decoration:none;">${title}</a>
              ${company ? `<div style="color:#475569; font-size:13px; margin-top:2px;">${company}${badge}</div>` : ''}
              <div style="color:#64748b; font-size:12px; margin-top:4px;">${metaParts}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export interface DigestEmailInput {
  to: string;
  alertName: string;
  jobs: Job[];
  unsubscribeUrl: string; // user-facing page
  unsubscribePostUrl: string; // RFC 8058 one-click POST endpoint
  manageUrl: string;
}

export async function sendDigestEmail(
  input: DigestEmailInput,
): Promise<string | null> {
  const { to, alertName, jobs, unsubscribeUrl, unsubscribePostUrl, manageUrl } =
    input;
  if (jobs.length === 0) return null;

  const subject = `[Polaris Jobs] ${jobs.length} việc làm mới cho "${alertName}"`;
  const rows = jobs.map(renderJobRow).join('');
  const safeName = escapeHtml(alertName);

  const html = `
    <div style="font-family: 'Segoe UI', -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #fff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #0f172a; font-size: 20px; margin: 0;">Polaris Jobs</h2>
        <p style="color: #64748b; font-size: 12px; margin: 4px 0 0;">Việc làm Data tại Việt Nam</p>
      </div>
      <h3 style="color: #0f172a; font-size: 16px; margin: 0 0 4px;">${jobs.length} việc làm mới</h3>
      <p style="color: #475569; font-size: 13px; margin: 0 0 20px;">
        khớp với thông báo <strong>${safeName}</strong> của bạn trong 24h qua.
      </p>
      <table style="width: 100%; border-collapse: collapse;">${rows}</table>
      <div style="text-align: center; margin-top: 28px;">
        <a href="${manageUrl}" style="display: inline-block; padding: 10px 20px; background: #059669; color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">Quản lý thông báo của bạn</a>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 16px;">
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
        Bạn nhận email này vì đã đăng ký thông báo việc làm.<br>
        <a href="${unsubscribeUrl}" style="color: #64748b;">Huỷ đăng ký thông báo này</a>
      </p>
    </div>`;

  const text = [
    `${jobs.length} việc làm mới cho "${alertName}":`,
    '',
    ...jobs.map((j) => {
      const src = SOURCE_LABELS[j.source] ?? j.source;
      const posted = formatRelativeVi(j.job_posted_date || j.created_at);
      const meta = [j.salary || 'Thỏa thuận', j.location, posted]
        .filter(Boolean)
        .join(' · ');
      return `- ${j.title}${j.company ? ` — ${j.company}` : ''} [${src}]\n  ${meta}\n  ${SITE_URL}/jobs/${encodeURIComponent(j.id)}`;
    }),
    '',
    `Quản lý thông báo: ${manageUrl}`,
    `Huỷ đăng ký: ${unsubscribeUrl}`,
  ].join('\n');

  const info = await getTransporter().sendMail({
    from: FROM,
    to,
    subject,
    html,
    text,
    headers: {
      'List-Unsubscribe': `<${unsubscribePostUrl}>, <${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });

  return info.messageId ?? null;
}
