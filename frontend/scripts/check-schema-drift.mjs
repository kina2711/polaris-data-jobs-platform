#!/usr/bin/env node
/**
 * Schema drift checker — so sánh bảng thực tế trên DB với các schema.prisma
 * của academy + jobs. Phát hiện:
 *   1. Orphan — bảng trong DB không có trong schema nào
 *   2. Missing — bảng trong schema.prisma nhưng không có trong DB
 *   3. Mirror — bảng cả 2 schema cùng define (JobAlert*): OK, không alert
 *
 * Ignore: _prisma_migrations (system), job_listings (crawler raw SQL),
 * account_credentials / sql_account_audit_log (non-Prisma legacy).
 *
 * Usage:
 *   DATABASE_URL='mysql://user:pass@host:3306/db' node scripts/check-schema-drift.mjs
 *
 * Exit: 0 clean, 1 drift, 2 error.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ACADEMY_SCHEMA = resolve(
  __dirname,
  '../../aquilalab_academy/prisma/schema.prisma',
);
const JOBS_SCHEMA = resolve(__dirname, '../prisma/schema.prisma');

function parseModels(schemaPath) {
  const content = readFileSync(schemaPath, 'utf8');
  const models = new Set();
  const modelRegex = /^model\s+(\w+)\s*\{/gm;
  let m;
  while ((m = modelRegex.exec(content)) !== null) {
    let name = m[1];
    const blockEnd = content.indexOf('\n}', m.index);
    const block = content.slice(m.index, blockEnd);
    const mapMatch = block.match(/@@map\("([^"]+)"\)/);
    if (mapMatch) name = mapMatch[1];
    models.add(name);
  }
  return models;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(2);
  }

  const academyTables = parseModels(ACADEMY_SCHEMA);
  const jobsTables = parseModels(JOBS_SCHEMA);
  const allSchemaTables = new Set([...academyTables, ...jobsTables]);

  const conn = await mysql.createConnection(url);
  const [rows] = await conn.query(
    `SELECT table_name AS name FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'`,
  );
  await conn.end();
  const dbTables = new Set(rows.map((r) => String(r.name)));

  const ignore = new Set([
    '_prisma_migrations',
    'job_listings',
    'account_credentials',
    'sql_account_audit_log',
  ]);

  const orphan = [...dbTables]
    .filter((t) => !allSchemaTables.has(t) && !ignore.has(t))
    .sort();
  const missing = [...allSchemaTables].filter((t) => !dbTables.has(t)).sort();
  const mirror = [...academyTables].filter((t) => jobsTables.has(t)).sort();

  console.log(`\nDB: ${url.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`  Tables in DB:      ${dbTables.size}`);
  console.log(`  Models (academy):  ${academyTables.size}`);
  console.log(`  Models (jobs):     ${jobsTables.size}`);
  console.log(
    `  Mirror (expected): ${mirror.length} — ${mirror.join(', ') || '—'}`,
  );
  console.log(`  Ignored:           ${[...ignore].join(', ')}`);

  let drift = 0;
  if (orphan.length > 0) {
    console.log(`\n⚠️  ORPHAN (in DB, not in any schema):`);
    orphan.forEach((t) => console.log(`    - ${t}`));
    drift += orphan.length;
  }
  if (missing.length > 0) {
    console.log(`\n⚠️  MISSING (in schema, not in DB):`);
    missing.forEach((t) => console.log(`    - ${t}`));
    drift += missing.length;
  }
  if (drift === 0) {
    console.log(`\n✅ No drift`);
    process.exit(0);
  } else {
    console.log(`\n❌ ${drift} drift item(s) detected`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(2);
});
