'use client';

import { useState } from 'react';
import Image from 'next/image';

interface CompanyLogoProps {
  url: string | null;
  company: string;
  size: number;
}

function safeLogoUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function CompanyLogo({ url, company, size }: CompanyLogoProps) {
  const [error, setError] = useState(false);
  const px = `${size}px`;
  const safeUrl = safeLogoUrl(url);

  if (!safeUrl || error) {
    return (
      <div
        className="rounded-xl border border-border/60 bg-secondary overflow-hidden flex items-center justify-center flex-shrink-0"
        style={{ width: px, height: px }}
      >
        <Image
          src="/default-company.svg"
          alt={`${company} logo`}
          width={size}
          height={size}
          className="w-full h-full"
        />
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-border/60 bg-secondary overflow-hidden flex items-center justify-center flex-shrink-0"
      style={{ width: px, height: px }}
    >
      <Image
        src={safeUrl}
        alt={`${company} logo`}
        width={size}
        height={size}
        className="w-full h-full object-contain"
        onError={() => setError(true)}
      />
    </div>
  );
}
