import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export async function POST() {
  try {
    const { stdout, stderr } = await execPromise('node scripts/vectorize.js');
    console.log('Vectorize Output:', stdout);
    if (stderr) console.error('Vectorize Error:', stderr);

    return NextResponse.json({
      message: 'Vectorization completed successfully',
      output: stdout,
    });
  } catch (error) {
    console.error('Vectorization execution failed:', error);
    return NextResponse.json(
      { error: 'Failed to run vectorization' },
      { status: 500 },
    );
  }
}
