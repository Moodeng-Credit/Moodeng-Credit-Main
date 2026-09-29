#!/usr/bin/env node
/**
 * eval-loan-reason.mjs
 *
 * Runs the deployed loan-reason checker (check-loan-input) over the test set in
 * supabase/functions/check-loan-input/eval-cases.json and prints what passed and what didn't.
 * Run it after every edit to loan-reason-guide.md, once the function is deployed:
 *
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<anon key> node tools/eval-loan-reason.mjs
 *
 * The anon key is the public one the app ships with. Each run costs a fraction of a cent.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.SUPABASE_URL ?? 'https://qplmmxynzxzkfxtayoqr.supabase.co';
const key = process.env.SUPABASE_ANON_KEY;
if (!key) {
   console.error('Set SUPABASE_ANON_KEY (the public anon key).');
   process.exit(1);
}

const cases = JSON.parse(await readFile(resolve(repo, 'supabase/functions/check-loan-input/eval-cases.json'), 'utf8'));

// What each group must come back as.
const expectations = {
   pass: (v) => v.ok === true && (v.category === 'good' || v.category === 'tip'),
   nudge: (v) => v.ok === false && (v.category === 'vague' || v.category === 'placeholder'),
   not_english: (v) => v.ok === false && v.category === 'not_english' && Boolean(v.suggestion),
   not_allowed: (v) => v.ok === false && v.category === 'not_allowed'
};

let failures = 0;
for (const [group, check] of Object.entries(expectations)) {
   const list = cases[group] ?? [];
   let passed = 0;
   for (const text of list) {
      const res = await fetch(`${url}/functions/v1/check-loan-input`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, apikey: key },
         body: JSON.stringify({ kind: 'reason', text })
      });
      const v = await res.json().catch(() => ({}));
      if (v.skipped) {
         console.log(`  ?? ${group}: checker failed open (${v.skipped}) on "${text}"`);
         failures += 1;
      } else if (check(v)) {
         passed += 1;
      } else {
         failures += 1;
         console.log(`  ✗ ${group}: "${text}" → ${v.category} | ${v.hint ?? ''} | ${v.suggestion ?? ''}`);
      }
   }
   console.log(`${group}: ${passed}/${list.length}`);
}
process.exit(failures ? 1 : 0);
