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
  const jobs =
    await prisma.$queryRaw`SELECT id, title, description, requirements FROM raw_jobs WHERE embedding IS NULL`;

  if (jobs.length === 0) {
    console.log('No jobs found to vectorize.');
    return;
  }

  console.log(`Found ${jobs.length} jobs to vectorize.`);

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

      await prisma.$executeRawUnsafe(
        'UPDATE raw_jobs SET embedding = $1::vector WHERE id = $2',
        vectorStr,
        job.id,
      );
      console.log('Done.');
    } catch (err) {
      console.error('Failed.', err);
    }
  }

  console.log('Vectorization complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
