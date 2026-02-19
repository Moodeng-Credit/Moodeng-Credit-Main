import { spawnSync } from 'child_process';

if (process.env.CI || process.env.VERCEL || process.env.DOCKER === '1') {
  console.log('CI/Vercel/Docker detected. Skipping Playwright browser installation.');
  process.exit(0);
}

console.log('Installing Playwright browsers and dependencies...');
const result = spawnSync('pnpm', ['playwright', 'install', '--with-deps'], {
  stdio: 'inherit',
  shell: true
});

if (result.status !== 0) {
  console.error('Failed to install Playwright browsers. You may need to run "pnpm exec playwright install" manually.');
  // Don't fail the build even if this fails locally, just in case
  process.exit(0);
}
