import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '../packages/api');
const shouldReset = process.argv.includes('--clean');

if (!shouldReset) {
  console.log('基础演示数据已维护在 scripts/seed.sql。');
  console.log('首次准备环境：cd packages/api && npm run db:setup');
  console.log('需要清理验证数据并恢复最小演示数据：node scripts/prepare-merchant-demo-data.mjs --clean');
  process.exit(0);
}

console.log('RESET minimal demo data with packages/api npm run db:setup');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npmCommand, ['run', 'db:setup'], {
  cwd: apiRoot,
  stdio: 'inherit',
  shell: false,
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

console.log('PASS minimal demo data is ready');
