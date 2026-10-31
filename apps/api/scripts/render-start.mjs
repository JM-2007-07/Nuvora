// Start command on a hosting platform (Render, a VPS): prepares the database, then starts the API.
// Runs from apps/api after `nest build`. Environment comes from the platform (no .env file).
//
// SEED_ON_START controls the data steps (default "demo"):
//   off         migrations only
//   content     migrations + learning content (db:seed: creates/updates, never deletes)
//   demo        content + the demo data (db:seed:demo) only when there are no demo learners yet
//   reset-demo  content + db:seed:demo on every start (resets demo learners and B-12; for a
//               fresh demo before a presentation, then switch back to "demo")
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const mode = process.env.SEED_ON_START ?? 'demo';
if (!['off', 'content', 'demo', 'reset-demo'].includes(mode)) {
  console.error(`SEED_ON_START must be off, content, demo or reset-demo (got "${mode}")`);
  process.exit(1);
}

function run(label, args) {
  console.log(`[start] ${label}`);
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  return result.status ?? 1;
}

function must(label, args) {
  const status = run(label, args);
  if (status !== 0) {
    console.error(`[start] ${label} failed (exit ${status}); the API is not started.`);
    process.exit(status);
  }
}

const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
must('prisma migrate deploy', [prismaCli, 'migrate', 'deploy']);
if (mode !== 'off') must('learning content (db:seed)', ['dist/seed/load/run.js']);
if (mode === 'reset-demo') must('demo data reset (db:seed:demo)', ['dist/seed/demo/run.js']);
if (mode === 'demo') {
  const needed = run('demo data check', ['dist/seed/demo/needs-demo.js']);
  if (needed === 0) must('demo data (db:seed:demo, first start)', ['dist/seed/demo/run.js']);
  else if (needed !== 3) process.exit(needed);
}

console.log('[start] starting the API');
await import(pathToFileURL('dist/main.js').href);
