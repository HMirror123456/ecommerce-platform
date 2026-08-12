import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const scripts = [
  'scripts/verify-merchant-onboarding.mjs',
  'scripts/verify-merchant-product-flow.mjs',
  'scripts/verify-merchant-product-batch.mjs',
  'scripts/verify-merchant-shipping.mjs',
  'scripts/verify-merchant-stock.mjs',
  'scripts/verify-merchant-after-sale.mjs',
  'scripts/verify-merchant-permissions.mjs',
];

for (const script of scripts) {
  console.log(`\n=== RUN ${script} ===`);
  const result = spawnSync(process.execPath, [path.resolve(projectRoot, script)], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    console.error(`\nFAIL ${script}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`\nFAIL ${script}: exit code ${result.status}`);
    process.exit(result.status || 1);
  }
  console.log(`=== PASS ${script} ===`);
}

console.log('\nPASS merchant all verification');
