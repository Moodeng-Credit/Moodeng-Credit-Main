#!/usr/bin/env node
/**
 * build-loan-reason-guide.mjs
 *
 * The loan-reason checker (supabase/functions/check-loan-input) reads
 * loan-reason-guide.md before judging every reason. Edge functions can't read a
 * .md file at runtime, so this bundles it into loanReasonGuide.ts.
 *
 * Run after every edit to the guide:
 *   node tools/build-loan-reason-guide.mjs
 * then check the verdicts still hold:
 *   node tools/eval-loan-reason.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(repo, 'supabase/functions/check-loan-input');

const guide = await readFile(resolve(dir, 'loan-reason-guide.md'), 'utf8');
const out = `// AUTO-GENERATED from loan-reason-guide.md by tools/build-loan-reason-guide.mjs — DO NOT EDIT.
// Edit loan-reason-guide.md, then re-run: node tools/build-loan-reason-guide.mjs
export const LOAN_REASON_GUIDE = ${JSON.stringify(guide)};
`;
await writeFile(resolve(dir, 'loanReasonGuide.ts'), out);
console.log(`Wrote loanReasonGuide.ts (${guide.length} chars)`);
