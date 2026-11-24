#!/usr/bin/env node
// Messenger reminder relay: sends the approved `moodeng_repay_reminder` Messenger template to borrowers
// we can only reach on Messenger. Facebook allows nothing else after their 24h window, and SendPulse
// sends utility templates only from its dashboard (its public API refuses them; tested 2026-11-22). So
// this runs headless Chrome with George's logged-in SendPulse session and calls the dashboard's own API.
//
// Each run: ask Supabase who is due (messenger_relay_claim) → open SendPulse → for each person, count
// the recipients of a filter on their SendPulse contact id and send ONLY when SendPulse says exactly 1
// → report back (messenger_relay_report). Logged out / page changed → one Telegram alert
// (messenger_relay_alert) and stop. Anything due today and not sent by 11:00 Bangkok goes to team
// Telegram from the database (private.messenger_reminder_watchdog). See
// supabase/migrations/20261122030000_messenger_reminder_relay.sql.
//
// Setup (once): scripts/messenger-relay/README.md
//   ~/.moodeng-messenger-relay/config.json  { "supabaseUrl", "publishableKey", "token" }
//   node relay.mjs --login     opens a Chrome window on its own profile: log into SendPulse, then close it.
//
// Run:   node relay.mjs            one pass (launchd runs it every 30 min and on wake)
//        node relay.mjs --check    log in check + who is due, sends nothing
//        node relay.mjs --login
//        node relay.mjs --test <contact id>   one real send to that contact (use George's own)
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const HOME = join(homedir(), '.moodeng-messenger-relay');
const PROFILE = join(HOME, 'chrome-profile');
const BOT_ID = '81acb48b-e32c-4c85-b29f-0efae2ca2716'; // Moodeng Credit Messenger bot in SendPulse
const TEMPLATE = 'moodeng_repay_reminder';
const ORIGIN = 'https://login.sendpulse.com';
const START_URL = `${ORIGIN}/messengers/campaigns/`;

const log = (...args) => console.log(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false }), ...args);
const config = JSON.parse(readFileSync(join(HOME, 'config.json'), 'utf8'));

// ---- Supabase (publishable key + relay token; the functions check the token) ----------------------

const rpc = async (fn, args) => {
   const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: config.token, ...args })
   });
   const text = await res.text();
   if (!res.ok) throw new Error(`${fn} ${res.status}: ${text.slice(0, 200)}`);
   return text ? JSON.parse(text) : null;
};
const report = (id, status, detail) => rpc('messenger_relay_report', { p_id: id, p_status: status, p_detail: detail ?? null });
const alert = (text) => rpc('messenger_relay_alert', { p_text: text }).catch((e) => log('alert failed', e.message));

// ---- SendPulse --------------------------------------------------------------------------------------

// The login is saved by a normal Chrome window (--login), which encrypts cookies with Chrome's usual
// key. Playwright would swap in a fake key (--use-mock-keychain) and could not read them, so keep Chrome's own.
const launch = (headless) =>
   chromium.launchPersistentContext(PROFILE, {
      channel: 'chrome',
      headless,
      viewport: { width: 1280, height: 860 },
      ignoreDefaultArgs: ['--use-mock-keychain']
   });

/** Opens SendPulse and picks up the Bearer token the dashboard adds to its own API calls. */
async function openSession(ctx) {
   const page = ctx.pages()[0] ?? (await ctx.newPage());
   let token = null;
   page.on('request', (req) => {
      const auth = req.headers().authorization;
      if (!token && req.url().startsWith(`${ORIGIN}/api/`) && auth?.startsWith('Bearer ')) token = auth;
   });
   await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
   for (let i = 0; i < 40 && !token; i++) await page.waitForTimeout(500);
   const url = page.url();
   if (!url.startsWith(`${ORIGIN}/messengers`))
      return { page, token: null, why: `logged out (landed on ${new URL(url).host}${new URL(url).pathname})` };
   if (!token) return { page, token: null, why: 'no API token seen (SendPulse page may have changed)' };
   return { page, token, why: null };
}

/** Calls the dashboard API from inside the page (same origin, same cookies + token). */
const api = (page, token, path, body) =>
   page.evaluate(
      async ({ path, body, token }) => {
         const res = await fetch(path, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               Accept: 'application/json',
               'X-Requested-With': 'XMLHttpRequest',
               Authorization: token
            },
            body: JSON.stringify(body)
         });
         return { status: res.status, text: (await res.text()).slice(0, 2000) };
      },
      { path, body, token }
   );

const onlyThisContact = (contactId) => ({ type: 'and', expressions: [{ operator: 'eq', field: 'id', value: contactId }] });

const CONTACT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function countRecipients(page, token, contactId) {
   const r = await api(page, token, `/api/messenger-service/bots/${BOT_ID}/campaign/recipients/total?message_tag=HUMAN_AGENT`, {
      order: 'desc',
      filter: onlyThisContact(contactId)
   });
   const total = r.status === 200 ? JSON.parse(r.text)?.data?.total : undefined;
   return typeof total === 'number' ? total : { error: `count ${r.status}: ${r.text.slice(0, 120)}` };
}

// Meta rejects a Messenger template whose parameters contain '#', '%', '$' or emojis ("Special characters
// ... not allowed in template parameter"). SendPulse still counts it as "sent", so every reminder with
// "$20" silently never arrived (found 2026-11-24 in the campaign report). "$20" → "20 USDC"; the rest is
// stripped, and runs of spaces collapsed.
const cleanTemplateParam = (value) =>
   String(value ?? '')
      .replace(/\$\s*(\d[\d.,]*)/g, '$1 USDC')
      .replace(/[#%$]/g, '')
      .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

const reminderText = (p) =>
   `Hi ${p.first_name}, this is a reminder that your Moodeng loan payment of ${p.amount_text} is due on ${p.due_text}. Tap the button below to see your balance and pay.`;

async function sendOne(page, token, p) {
   // Never send without a well-formed contact id: an empty or odd filter must not reach SendPulse.
   if (!CONTACT_ID.test(p.contact_id ?? '')) return { ok: false, why: `bad contact id "${p.contact_id}"` };
   const params = [p.first_name, p.amount_text, p.due_text].map(cleanTemplateParam);
   if (params.some((v) => !v)) return { ok: false, why: 'missing name/amount/date' };

   const n = await countRecipients(page, token, p.contact_id);
   if (n !== 1) return { ok: false, why: typeof n === 'number' ? `SendPulse counted ${n} recipients, not 1` : n.error };

   const filter = onlyThisContact(p.contact_id);
   const body = {
      messages: [
         {
            template: {
               name: TEMPLATE,
               components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }],
               language: { code: 'en' }
            }
         }
      ],
      actions: [],
      options: {
         notification_type: 'REGULAR',
         message_type: 'UTILITY',
         title: `Repay reminder ${p.kind} - ${p.first_name} - ${p.due_text} (relay #${p.id})`,
         is_draft: false,
         settings: [{ elementType: 'text', elements: [{ buttons: [], text: reminderText(p) }], files: [] }]
      },
      bot_id: BOT_ID,
      filter
   };
   // Last guard right before sending: the filter in the body is exactly one id expression.
   if (body.filter.expressions.length !== 1 || body.filter.expressions[0].value !== p.contact_id)
      return { ok: false, why: 'filter check failed' };
   const r = await api(page, token, '/api/messenger-service/campaigns', body);
   const parsed = (() => {
      try {
         return JSON.parse(r.text);
      } catch {
         return null;
      }
   })();
   if (r.status >= 200 && r.status < 300 && parsed?.success !== false)
      return { ok: true, why: `campaign ${parsed?.data?.id ?? parsed?.data?._id ?? '?'}` };
   return { ok: false, why: `send ${r.status}: ${r.text.slice(0, 160)}` };
}

// ---- Modes ----------------------------------------------------------------------------------------

// Google refuses to sign in inside a browser driven by automation software, so log in with a plain
// Chrome window (no automation) on the relay's own profile; the headless runs reuse that login.
async function login() {
   const { spawn } = await import('node:child_process');
   const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
   console.log('Log into SendPulse in the Chrome window, open Chatbots → Campaigns, then quit that window (⌘Q).');
   const child = spawn(chrome, [`--user-data-dir=${PROFILE}`, '--no-first-run', '--no-default-browser-check', START_URL], {
      stdio: 'ignore'
   });
   await new Promise((r) => child.on('exit', r));
   console.log('Saved. Run: node relay.mjs --check');
}

async function pass({ dryRun }) {
   const people = dryRun ? [] : await rpc('messenger_relay_claim', {});
   if (!dryRun && !people?.length) return log('nothing due');
   const ctx = await launch(true);
   try {
      const { page, token, why } = await openSession(ctx);
      if (!token) {
         log('stop:', why);
         // Not their fault: give the try back so they go out once George logs in again.
         for (const p of people ?? []) await report(p.id, 'released', why);
         await alert(
            `${why}. ${people?.length ?? 0} reminder(s) waiting. On the Mac run: node ~/.moodeng-messenger-relay/relay.mjs --login (they also go to team Telegram at 11:00 if still unsent).`
         );
         return;
      }
      if (dryRun) {
         log('logged in to SendPulse, API token OK');
         return;
      }
      for (const p of people) {
         try {
            const res = await sendOne(page, token, p);
            log(res.ok ? 'sent' : 'NOT sent', `#${p.id}`, p.kind, p.first_name, p.amount_text, p.due_text, '-', res.why);
            await report(p.id, res.ok ? 'sent' : 'failed', res.why);
         } catch (err) {
            log('error', `#${p.id}`, err.message);
            await report(p.id, 'failed', `relay error: ${err.message}`.slice(0, 300)).catch(() => {});
         }
      }
   } finally {
      await ctx.close();
   }
}

// --test <SendPulse contact id>: one real send to that contact (George's own), outside the database.
async function testSend(contactId) {
   const ctx = await launch(true);
   try {
      const { page, token, why } = await openSession(ctx);
      if (!token) return log('stop:', why);
      const res = await sendOne(page, token, {
         id: 0,
         kind: 'test',
         contact_id: contactId,
         first_name: 'George',
         amount_text: '$1 (TEST)',
         due_text: 'Mon 1 Dec'
      });
      log(res.ok ? 'TEST sent' : 'TEST not sent', '-', res.why);
   } finally {
      await ctx.close();
   }
}

const mode = process.argv[2];
try {
   if (mode === '--login') await login();
   else if (mode === '--test') await testSend(process.argv[3]);
   else await pass({ dryRun: mode === '--check' });
} catch (err) {
   log('failed:', err.message);
   process.exitCode = 1;
}
