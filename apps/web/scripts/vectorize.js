const { PrismaClient } = require('@prisma/client');
const { pipeline } = require('@xenova/transformers');

const prisma = new PrismaClient();

async function main() {
  console.log('Initializing transformer pipeline...');
  // Use a small, fast, cross-lingual model or standard MiniLM
  const generateEmbeddings = await pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2',
    {
      quantized: true, // much faster
    },
  );

  console.log('Fetching raw jobs without embeddings...');
  // Fetch jobs that don't have embeddings yet
  const jobs = await prisma.$queryRaw`
    SELECT id, title, description, requirements
    FROM raw_jobs
    WHERE embedding IS NULL
    ORDER BY crawled_at ASC
    LIMIT 500
  `;

  if (jobs.length === 0) {
    console.log('No jobs found to vectorize.');
    console.log('VECTORIZE_RESULT={"updated":0,"failed":0}');
    return;
  }

  console.log(`Found ${jobs.length} jobs to vectorize.`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const textToEmbed =
      `Title: ${job.title}\nRequirements: ${job.requirements}\nDescription: ${job.description}`.replace(
        /<[^>]*>?/gm,
        '',
      ); // strip HTML if any

    process.stdout.write(
      `[${i + 1}/${jobs.length}] Vectorizing job ${job.id}... `,
    );
    try {
      const output = await generateEmbeddings(textToEmbed, {
        pooling: 'mean',
        normalize: true,
      });

      // Output data is a Float32Array, convert to standard JS array
      const vector = Array.from(output.data);
      const vectorStr = `[${vector.join(',')}]`;

      await prisma.$executeRaw`
        UPDATE raw_jobs
        SET embedding = CAST(${vectorStr} AS vector)
        WHERE id = ${job.id}
      `;
      updated += 1;
      console.log('Done.');
    } catch (err) {
      failed += 1;
      console.error('Failed.', err);
    }
  }

  const result = { updated, failed };
  console.log(`VECTORIZE_RESULT=${JSON.stringify(result)}`);

  if (failed > 0) {
    throw new Error(
      `Vectorization failed for ${failed} of ${jobs.length} jobs.`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
