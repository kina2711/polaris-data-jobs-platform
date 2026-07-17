import { timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { NextRequest, NextResponse } from 'next/server';

const execFileAsync = promisify(execFile);

function isAuthorized(request: NextRequest): boolean {
  const expectedToken = process.env.INTERNAL_VECTORIZER_TOKEN;
  const providedToken = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '');

  if (!expectedToken || !providedToken) return false;

  const expected = Buffer.from(expectedToken);
  const provided = Buffer.from(providedToken);
  return (
    expected.length === provided.length && timingSafeEqual(expected, provided)
  );
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ['scripts/vectorize.js'],
      {
        timeout: 300_000,
        maxBuffer: 2 * 1024 * 1024,
        windowsHide: true,
      },
    );
    const summaryLine = stdout
      .split(/\r?\n/)
      .reverse()
      .find((line) => line.startsWith('VECTORIZE_RESULT='));
    const summary = summaryLine
      ? JSON.parse(summaryLine.slice('VECTORIZE_RESULT='.length))
      : { updated: 0, failed: 0 };

    if (stderr.trim()) {
      console.warn('Vectorizer stderr:', stderr.trim());
    }

    return NextResponse.json({
      message: 'Vectorization completed successfully',
      ...summary,
    });
  } catch (error) {
    console.error('Vectorization execution failed:', error);
    return NextResponse.json(
      { error: 'Failed to run vectorization' },
      { status: 500 },
    );
  }
}
