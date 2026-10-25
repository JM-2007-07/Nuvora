// Runs the Prisma CLI with apps/api/.env loaded (Node's built-in loader).
// Used only for commands that need the database, e.g. `migrate deploy`.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

if (!existsSync('.env')) {
  console.error(
    'apps/api/.env not found. Copy apps/api/.env.example to .env and fill in your local database credentials.',
  );
  process.exit(1);
}
process.loadEnvFile('.env');

const require = createRequire(import.meta.url);
const prismaCli = require.resolve('prisma/build/index.js');
const result = spawnSync(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});
process.exit(result.status ?? 1);
