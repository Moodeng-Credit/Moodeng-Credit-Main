#!/usr/bin/env node
// Viber relay: sends Moodeng's Viber reminders and opt-in codes from an ordinary Viber account
// signed in on the Android emulator (MoodengPixel) on George's Mac. Viber's business options all cost
// €100+/month, so this types each message into the Viber app and taps Send (George, 2026-10-19).
//
// Loop: every 20 s, ask Supabase for queued messages (viber_relay_claim), send each one, report back
// (viber_relay_report). If this stops, queued messages wait and the team gets a Telegram alert after
// 10 minutes (private.viber_watchdog). See supabase/migrations/20261019090000_viber_reminders.sql.
//
// Setup (once):
//   1. Emulator running with Viber signed in (scripts/viber-relay/README.md).
//   2. ~/.moodeng-viber-relay/config.json  { "supabaseUrl": "...", "publishableKey": "...", "token": "<VIBER_RELAY_TOKEN>" }
//      The token is the Vault secret VIBER_RELAY_TOKEN; nothing else secret lives on this Mac.
//
// Run:   node scripts/viber-relay/relay.mjs              (loop)
//        node scripts/viber-relay/relay.mjs --once       (one pass, then exit)
//        node scripts/viber-relay/relay.mjs --send 66812345678 "hello"   (test one message, no Supabase)
//        node scripts/viber-relay/relay.mjs --here "hello"   (type + Send in the chat open now, e.g. My Notes)
//        node scripts/viber-relay/relay.mjs --dump       (print the screen's UI elements, for fixing taps)

import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ADB = process.env.ADB ?? join(homedir(), 'Library/Android/sdk/platform-tools/adb');
const SERIAL = process.env.ANDROID_SERIAL ?? 'emulator-5554';
const POLL_MS = 20_000;
const VIBER_PKG = 'com.viber.voip';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...args) =>
   console.log(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false }), ...args);

const adb = async (...args) => (await run(ADB, ['-s', SERIAL, ...args], { maxBuffer: 8 * 1024 * 1024 })).stdout;
const shell = (cmd) => adb('shell', cmd);

// ---------------------------------------------------------------------------------------------------
// Screen reading: uiautomator dumps the current screen as XML; we only need text, ids, class, bounds.

const dumpNodes = async () => {
   await shell('uiautomator dump /sdcard/mdng-ui.xml >/dev/null 2>&1');
   const xml = await shell('cat /sdcard/mdng-ui.xml');
   const nodes = [];
   for (const m of xml.matchAll(/<node ([^>]*?)\/?>/g)) {
      const attr = (name) => m[1].match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? '';
      const b = attr('bounds').match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
      if (!b) continue;
      nodes.push({
         text: attr('text'),
         desc: attr('content-desc'),
         id: attr('resource-id'),
         cls: attr('class'),
         clickable: attr('clickable') === 'true',
         focused: attr('focused') === 'true',
         x: Math.round((Number(b[1]) + Number(b[3])) / 2),
         y: Math.round((Number(b[2]) + Number(b[4])) / 2)
      });
   }
   return nodes;
};

const tap = (node) => shell(`input tap ${node.x} ${node.y}`);

// `input text` only takes plain ASCII, with spaces as %s. The command goes through the device's shell
// inside single quotes, so only ' itself needs escaping ('\'').
const toInputText = (text) =>
   text
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, ' ')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/ /g, '%s');

const shellQuote = (text) => `'${text.replace(/'/g, `'\\''`)}'`;

const findComposer = (nodes) =>
   nodes.find((n) => n.id === `${VIBER_PKG}:id/send_text`) ?? nodes.find((n) => n.cls === 'android.widget.EditText');

const findSend = (nodes) => nodes.find((n) => n.id === `${VIBER_PKG}:id/btn_send`);

// The contact page's "Free message" / "Message" button (a number on Viber).
const findMessageButton = (nodes) =>
   nodes.find((n) => n.clickable && /^(free )?(viber )?message$|^send message$/i.test(n.text || n.desc)) ??
   nodes.find((n) => n.clickable && /message_button|btn_message|free_message/i.test(n.id));

// Not on Viber: the contact page offers "Invite to Viber" instead.
const notOnViber = (nodes) =>
   nodes.some((n) => n.id === `${VIBER_PKG}:id/invite_button` || /does not have viber|invite to viber/i.test(`${n.text} ${n.desc}`));

const waitFor = async (pick, { tries = 10, fail } = {}) => {
   for (let i = 0; i < tries; i += 1) {
      await sleep(1000);
      const nodes = await dumpNodes();
      if (fail?.(nodes)) return { failed: true };
      const found = pick(nodes);
      if (found) return { found };
   }
   return {};
};

// ---------------------------------------------------------------------------------------------------
// Send one message: open the number's contact page, tap Message, type, tap Send, check the box emptied.
// (viber://chat?number= shows "Request unavailable" on current Viber; viber://contact?number= works.)

// What the box should hold once typed: the same text `input text` can type, with real spaces.
const expectedText = (body) => toInputText(body).replace(/%s/g, ' ');
const normalize = (text) => text.replace(/\s+/g, ' ').trim();

// Empty the box: tap it, jump to the end, delete. (No Ctrl+A: on this emulator it opened Calendar.)
const clearComposer = async () => {
   const box = findComposer(await dumpNodes());
   if (!box || !box.text || /^message/i.test(box.text)) return;
   await tap(box);
   // Down to the last line, to its end, then delete everything (MOVE_END alone stays on one line).
   const downs = Array(20).fill('20').join(' ');
   const dels = Array(box.text.length + 10).fill('67').join(' ');
   await shell(`input keyevent ${downs} 123 ${dels}`);
   await sleep(300);
};

const typeInto = async (composer, body) => {
   await tap(composer);
   await sleep(500);
   // Typing anywhere else fires keyboard shortcuts (it opened Calendar once), so only into a focused box.
   if (!findComposer(await dumpNodes())?.focused) throw new Error('message_box_not_focused');
   // Viber's box drops characters when text arrives faster than it can take it (60- and 20-character
   // pieces both lost letters), so type one word at a time with a pause after each.
   const words = toInputText(body).split('%s');
   for (let i = 0; i < words.length; i += 1) {
      const word = i < words.length - 1 ? `${words[i]}%s` : words[i];
      if (word) await shell(`input text ${shellQuote(word)}`);
      await sleep(250);
   }
   await sleep(700);
};

const typeAndSend = async (composer, body) => {
   const want = normalize(expectedText(body));
   // Read the box back before sending: a pop-up mid-typing once swallowed words (2026-10-19). Retype
   // once; if it's still wrong, don't send a garbled reminder, fail (the team gets it after 3 tries).
   let typed = '';
   for (let attempt = 0; attempt < 2; attempt += 1) {
      await clearComposer();
      const box = findComposer(await dumpNodes()) ?? composer;
      await typeInto(box, body);
      typed = normalize(findComposer(await dumpNodes())?.text ?? '');
      if (typed === want) break;
   }
   if (typed !== want) {
      await clearComposer();
      throw new Error(`typing_mismatch: box had "${typed.slice(0, 120)}"`);
   }

   const send = findSend(await dumpNodes());
   if (!send) throw new Error('send_button_not_found');
   await tap(send);
   await sleep(1500);

   const after = findComposer(await dumpNodes());
   if (after?.text && after.text.length > 3 && !/^message/i.test(after.text)) throw new Error('not_sent_text_still_in_box');
};

// ---------------------------------------------------------------------------------------------------
// Borrowers as phone contacts named "MDNG +<number>": Viber then shows that name on their messages, so
// the relay can tell borrower chats from George's own (same Viber account) and knows the number.

const contactName = (digits) => `MDNG +${digits}`;

export const ensureContact = async (digits) => {
   const name = contactName(digits);
   const found = await shell(
      `content query --uri content://com.android.contacts/data --projection raw_contact_id --where "mimetype='vnd.android.cursor.item/name' AND data1='${name}'"`
   );
   if (/raw_contact_id=\d+/.test(found)) return;
   await shell('content insert --uri content://com.android.contacts/raw_contacts --bind account_type:n: --bind account_name:n:');
   const last = await shell("content query --uri content://com.android.contacts/raw_contacts --projection _id --sort '_id DESC'");
   const rid = last.match(/_id=(\d+)/)?.[1];
   if (!rid) throw new Error('contact_not_saved');
   await shell(
      `content insert --uri content://com.android.contacts/data --bind raw_contact_id:i:${rid} --bind mimetype:s:vnd.android.cursor.item/name --bind data1:s:'${name}'`
   );
   await shell(
      `content insert --uri content://com.android.contacts/data --bind raw_contact_id:i:${rid} --bind mimetype:s:vnd.android.cursor.item/phone_v2 --bind data1:s:+${digits} --bind data2:i:2`
   );
};

// New messages in borrower chats, from Viber's notifications: [{ phone, text, key }]. Only senders named
// "MDNG +<number>"; everything else (George's own chats) is never read past the title.
export const readInbound = async () => {
   const dump = await shell('dumpsys notification --noredact');
   const out = [];
   for (const record of dump.split(/\n\s*NotificationRecord\(/).slice(1)) {
      if (!/pkg=com\.viber\.voip /.test(record)) continue;
      const title = record.match(/android\.title=String \((.*)\)\s*$/m)?.[1] ?? '';
      const phone = title.match(/^MDNG \+(\d{8,15})\b/)?.[1];
      if (!phone) continue;
      const text = record.match(/android\.text=String \((.*)\)\s*$/m)?.[1] ?? '';
      const when = record.match(/when=(\d+)/)?.[1] ?? '';
      if (text) out.push({ phone, text, key: `${phone}|${when}|${text}` });
   }
   return out;
};

export const sendViber = async (phone, body) => {
   const digits = String(phone).replace(/\D/g, '');
   if (digits.length < 8) throw new Error('bad_number');
   await ensureContact(digits);
   await shell(`am start -W -a android.intent.action.VIEW -d 'viber://contact?number=%2B${digits}' ${VIBER_PKG} >/dev/null`);

   const contact = await waitFor(findMessageButton, { fail: notOnViber });
   if (contact.failed) {
      await shell('input keyevent KEYCODE_BACK');
      throw new Error('not_on_viber');
   }
   if (!contact.found) throw new Error('contact_page_did_not_open');
   await tap(contact.found);

   const chat = await waitFor(findComposer);
   if (!chat.found) throw new Error('chat_did_not_open');
   await typeAndSend(chat.found, body);
   await shell('input keyevent KEYCODE_HOME');
};

// Test typing + Send on whatever chat is open (e.g. My Notes), without opening a number.
export const sendInOpenChat = async (body) => {
   const composer = findComposer(await dumpNodes());
   if (!composer) throw new Error('no_chat_open');
   await typeAndSend(composer, body);
};

// ---------------------------------------------------------------------------------------------------
// Supabase: two RPCs, authorised by the relay token only.

const loadConfig = () => {
   const path = process.env.VIBER_RELAY_CONFIG ?? join(homedir(), '.moodeng-viber-relay', 'config.json');
   const cfg = JSON.parse(readFileSync(path, 'utf8'));
   for (const key of ['supabaseUrl', 'publishableKey', 'token']) if (!cfg[key]) throw new Error(`${path}: missing ${key}`);
   return cfg;
};

const rpc = async (cfg, name, args) => {
   const res = await fetch(`${cfg.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: cfg.publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
   });
   const body = await res.json().catch(() => null);
   if (!res.ok) throw new Error(`${name} ${res.status}: ${JSON.stringify(body)?.slice(0, 200)}`);
   return body;
};

// Notifications we already forwarded (they stay until the chat is opened), kept across restarts.
const SEEN_PATH = join(homedir(), '.moodeng-viber-relay', 'seen.json');
const loadSeen = () => {
   try {
      return new Set(JSON.parse(readFileSync(SEEN_PATH, 'utf8')));
   } catch {
      return new Set();
   }
};
const seen = loadSeen();

const forwardInbound = async (cfg) => {
   let changed = false;
   for (const msg of await readInbound()) {
      if (seen.has(msg.key)) continue;
      await rpc(cfg, 'viber_relay_inbound', { p_token: cfg.token, p_phone: msg.phone, p_body: msg.text });
      seen.add(msg.key);
      changed = true;
      log(`forwarded a Viber reply from …${msg.phone.slice(-4)}`);
   }
   if (changed) writeFileSync(SEEN_PATH, JSON.stringify([...seen].slice(-500)));
};

const pass = async (cfg) => {
   await forwardInbound(cfg).catch((err) => log('reading replies failed:', err instanceof Error ? err.message : err));
   const rows = await rpc(cfg, 'viber_relay_claim', { p_token: cfg.token, p_limit: 5 });
   for (const row of rows ?? []) {
      try {
         await sendViber(row.phone, row.body);
         await rpc(cfg, 'viber_relay_report', { p_token: cfg.token, p_id: row.id, p_ok: true });
         log(`sent #${row.id} (${row.kind}) to …${String(row.phone).slice(-4)}`);
      } catch (err) {
         const reason = err instanceof Error ? err.message : String(err);
         await rpc(cfg, 'viber_relay_report', { p_token: cfg.token, p_id: row.id, p_ok: false, p_error: reason }).catch(() => undefined);
         log(`failed #${row.id} (${row.kind}) to …${String(row.phone).slice(-4)}: ${reason}`);
         await shell('input keyevent KEYCODE_HOME').catch(() => undefined);
      }
   }
   return rows?.length ?? 0;
};

const main = async () => {
   const args = process.argv.slice(2);
   if (args[0] === '--dump') {
      for (const n of await dumpNodes()) if (n.text || n.desc || n.id) console.log(JSON.stringify(n));
      return;
   }
   if (args[0] === '--contact') {
      await ensureContact(String(args[1]).replace(/\D/g, ''));
      log('contact saved (or already there)');
      return;
   }
   if (args[0] === '--inbox') {
      // Print the borrower messages the relay would forward now (forwards nothing).
      console.log(JSON.stringify(await readInbound(), null, 1));
      return;
   }
   if (args[0] === '--type-check') {
      // Type into the open chat, read it back, clear it. Never sends.
      const body = args.slice(1).join(' ');
      await clearComposer();
      const box = findComposer(await dumpNodes());
      if (!box) throw new Error('no_chat_open');
      await typeInto(box, body);
      const typed = normalize(findComposer(await dumpNodes())?.text ?? '');
      log(typed === normalize(expectedText(body)) ? 'MATCH' : `MISMATCH: "${typed}"`);
      await clearComposer();
      return;
   }
   if (args[0] === '--here') {
      await sendInOpenChat(args.slice(1).join(' ') || 'Test from Moodeng Credit');
      log('sent in the open chat');
      return;
   }
   if (args[0] === '--send') {
      await sendViber(args[1], args.slice(2).join(' ') || 'Test from Moodeng Credit');
      log('sent');
      return;
   }
   const cfg = loadConfig();
   if (args[0] === '--once') {
      log(`one pass: ${await pass(cfg)} message(s)`);
      return;
   }
   log(`Viber relay running on ${SERIAL}; checking every ${POLL_MS / 1000}s. Ctrl+C to stop.`);
   for (;;) {
      // Emulator gone (window closed, crash): exit, so launchd re-runs start.sh, which boots it again.
      const devices = await run(ADB, ['devices']).then((r) => r.stdout).catch(() => '');
      if (!devices.includes(SERIAL)) {
         log(`${SERIAL} is gone; exiting so start.sh boots it again`);
         process.exit(1);
      }
      try {
         await pass(cfg);
      } catch (err) {
         log('pass failed:', err instanceof Error ? err.message : err);
      }
      await sleep(POLL_MS);
   }
};

main().catch((err) => {
   console.error(err);
   process.exit(1);
});
