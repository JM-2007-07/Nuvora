import { checkContent, formatReport } from './check-content.js';
import { content } from './content/index.js';
import { FIXTURES, type FixtureName } from './fixtures.js';

/**
 * pnpm seed:check                      validate the real seed content (no database)
 * pnpm seed:check --fixture <name>     validate a deliberately broken fixture (expected to fail)
 * pnpm seed:check --all-fixtures       run every fixture and confirm each one fails
 */
const args = process.argv.slice(2);
const fixtureIndex = args.indexOf('--fixture');

if (args.includes('--all-fixtures')) {
  let allCaught = true;
  for (const [name, set] of Object.entries(FIXTURES)) {
    const result = checkContent(set);
    console.log(`${formatReport(result, `fixture "${name}"`)}\n`);
    if (result.errors === 0) allCaught = false;
  }
  console.log(allCaught ? 'All fixtures were rejected as expected.' : 'A broken fixture passed: the checker missed a defect.');
  process.exitCode = allCaught ? 0 : 1;
} else if (fixtureIndex !== -1) {
  const name = args[fixtureIndex + 1] as FixtureName;
  const set = FIXTURES[name];
  if (!set) {
    console.error(`Unknown fixture "${name}". Available: ${Object.keys(FIXTURES).join(', ')}`);
    process.exitCode = 2;
  } else {
    const result = checkContent(set);
    console.log(formatReport(result, `fixture "${name}"`));
    process.exitCode = result.errors ? 1 : 0;
  }
} else {
  const result = checkContent(content);
  console.log(formatReport(result, 'seed content'));
  process.exitCode = result.errors ? 1 : 0;
}
