#!/usr/bin/env node
/**
 * Cross-platform clean install.
 * Removes node_modules and package-lock.json, then runs pnpm install.
 * Use when node_modules is corrupted (e.g. after mixing npm/pnpm).
 */
import { rmSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';

const dirs = ['node_modules'];
const files = ['package-lock.json'];

for (const d of dirs) {
  if (existsSync(d)) {
    console.log(`Removing ${d}...`);
    rmSync(d, { recursive: true, force: true });
  }
}

for (const f of files) {
  if (existsSync(f)) {
    console.log(`Removing ${f}...`);
    rmSync(f, { force: true });
  }
}

console.log('Running pnpm install...');
const result = spawnSync('pnpm', ['install'], {
  stdio: 'inherit',
  shell: true
});
process.exit(result.status ?? 1);
