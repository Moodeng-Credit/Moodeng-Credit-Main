// Book-your-call reminder (George 2026-11-23). People the team (or the AI) marked ✅ Good fit on the
// pre-screening sometimes do every step and then never book the 15-min call: nothing reminded them,
// and some waited for an "invite" we never send (one came via an affiliate link: wallet + WhatsApp
// done, no call a day later). 4 of 26 good fits in the week to 2026-11-23 were stuck like that.
//
// loan-access action=book_nudge (pg_cron, hourly) sends at most two reminders per pre-screening:
//   1st  ≥ 6h after the ✅ Good fit
//   2nd  ≥ 24h after the 1st
// only 09:00–21:00 Manila, and only within 7 days of the ✅. Each goes out on Messenger (their exact
// next step from the bot, plus "you pick the time, no invite"), as a push, and as a text (no window
// limit; migration 20261123120000). One Telegram line per run tells the team who got one.
//
// Switch: telegram_bot_settings.book_call_nudge = 'off' stops it (anything else = on).

import { loadPerson, nextStepReply, withBookHere } from './botNextStep.ts';
import { CONNECT_URL, getAdminChatId } from './loanAccess.ts';
import { sendPushToUser } from './pushDelivery.ts';
import { sendMessengerMessage } from './sendpulse.ts';
import { sendTelegramMessage } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export const FIRST_AFTER_MS = 6 * 3600000;
export const SECOND_AFTER_MS = 24 * 3600000;
export const GIVE_UP_AFTER_MS = 7 * 86400000;
export const MAX_NUDGES = 2;
const MANILA_OFFSET_MS = 8 * 3600000;

// The steps before the call. Anyone past them (booked, approved, rejected) is left alone.
const BEFORE_CALL = new Set(['wallet', 'messenger', 'about', 'book_call']);

export type NudgeRow = {
   id: string;
   user_id: string;
   team_decided_at: string | null;
   book_nudges: number | null;
   book_nudged_at: string | null;
};

/** 09:00–20:59 in Manila: no texts in the night. Pure. */
export const isDaytimeManila = (now: number) => {
   const hour = new Date(now + MANILA_OFFSET_MS).getUTCHours();
   return hour >= 9 && hour < 21;
};

/** Which reminder (1 or 2) is due now for this pre-screening, or null. Pure. */
export const nudgeDue = (row: NudgeRow, now: number): 1 | 2 | null => {
   const decided = Date.parse(row.team_decided_at ?? '');
   if (Number.isNaN(decided) || now - decided > GIVE_UP_AFTER_MS) return null;
   const sent = row.book_nudges ?? 0;
   if (sent >= MAX_NUDGES) return null;
   if (sent === 0) return now - decided >= FIRST_AFTER_MS ? 1 : null;
   const last = Date.parse(row.book_nudged_at ?? '');
   return !Number.isNaN(last) && now - last >= SECOND_AFTER_MS ? 2 : null;
};

const LEAD: Record<1 | 2, { en: string; fil: string }> = {
   1: {
      en: "👋 Reminder: you passed the pre-screening! 🎉 You book the call yourself, so there's no invite to wait for. You pick the time.",
      fil: '👋 Paalala: pasado ka sa pre-screening! 🎉 Ikaw mismo ang magbo-book ng call, kaya walang invite na hihintayin. Ikaw ang pipili ng oras.'
   },
   2: {
      en: '👋 Your spot is still open! Book your 15-min call and you can ask for your first loan right after. You pick the time.',
      fil: '👋 Bukas pa ang slot mo! Mag-book ng 15-min call at puwede ka nang humiram ng unang loan pagkatapos. Ikaw ang pipili ng oras.'
   }
};

/** The Messenger text: greeting + reminder line + their next step from the bot. Pure. */
export const nudgeText = (nudge: 1 | 2, locale: 'en' | 'fil', firstName: string | null, stepText: string) =>
   `${firstName ? `Hi ${firstName}! ` : ''}${LEAD[nudge][locale]}\n\n${stepText}`;

type Sent = { userId: string; username: string | null; nudge: 1 | 2; ways: string[]; note: string };

type Person = Awaited<ReturnType<typeof loadPerson>>;

// Messenger: their exact next step (wallet / about you / book), like the bot menu's ✅ How do I verify?
const sendStep = async (psid: string, nudge: 1 | 2, person: Person): Promise<boolean> => {
   const base = nextStepReply(person.stage, person.locale, null, person.triesLeft);
   const reply = person.bookHere ? withBookHere(base, person.locale) : base;
   const [button, ...moreButtons] = reply.buttons;
   const sent = await sendMessengerMessage(psid, {
      text: nudgeText(nudge, person.locale, person.firstName, reply.text),
      card: button ? { title: reply.cardTitle, button, moreButtons } : undefined
   }).catch(() => ({ ok: false as const, reason: 'error' }));
   return sent.ok;
};

const sendOne = async (svc: SupabaseClient, row: NudgeRow, nudge: 1 | 2, psid: string | null): Promise<{ ways: string[]; note: string } | null> => {
   let messenger = false;
   if (psid) {
      const person = await loadPerson(svc, psid);
      // Their Facebook is linked to a newer account: skip Messenger, the push and text still go.
      if (person.user?.id === row.user_id) {
         if (!BEFORE_CALL.has(person.stage)) return null;
         messenger = await sendStep(psid, nudge, person);
      }
   }
   const [push, sms] = await Promise.all([
      sendPushToUser(svc, row.user_id, () => ({
         type: 'loan_access_decision',
         title: nudge === 1 ? 'Book your 15-min call 📅' : 'Your spot is still open 📅',
         body: 'You passed the pre-screening. You pick the time, no invite needed.',
         url: CONNECT_URL,
         tag: 'book-call-nudge'
      })).catch(() => null),
      svc.rpc('prescreen_book_sms', { p_user: row.user_id, p_nudge: nudge }).then(
         ({ data }: { data: unknown }) => (typeof data === 'string' ? data : 'failed'),
         () => 'failed'
      )
   ]);
   const pushed = Boolean(push && (push as { sent?: number }).sent);
   const texted = sms === 'sent' || sms === 'unconfirmed';
   const ways = [messenger ? 'Messenger' : null, pushed ? 'push' : null, texted ? 'text' : null].filter(Boolean) as string[];
   const note = sms === 'rejected_network' ? 'no text: Smart/TNT/Sun' : sms === 'no_number' ? 'no number to text' : sms === 'off' ? 'texts off' : '';
   return { ways, note };
};

/** dry: who would get which reminder (and their bot stage), with nothing claimed or sent. */
export const runBookCallNudges = async (svc: SupabaseClient, now = Date.now(), opts: { dry?: boolean } = {}) => {
   const { data: setting } = await svc.from('telegram_bot_settings').select('value').eq('key', 'book_call_nudge').maybeSingle();
   if (!opts.dry && String(setting?.value ?? '').trim().toLowerCase() === 'off') return { ok: true, skipped: 'off', sent: 0 };
   if (!opts.dry && !isDaytimeManila(now)) return { ok: true, skipped: 'night', sent: 0 };

   const { data, error } = await svc
      .from('pre_screenings')
      .select(
         'id, user_id, team_decided_at, book_nudges, book_nudged_at, users!inner(id, username, messenger_psid, is_test, prescreen_path, loan_access_status, video_call_booking_uid, video_call_starts_at, ghosted_at, blocked_for_good_at)'
      )
      .eq('team_decision', 'good')
      .is('team_rejected_at', null)
      .lt('book_nudges', MAX_NUDGES)
      .gte('team_decided_at', new Date(now - GIVE_UP_AFTER_MS).toISOString())
      .eq('users.is_test', false)
      .eq('users.prescreen_path', true)
      .eq('users.loan_access_status', 'none')
      .is('users.video_call_booking_uid', null)
      .is('users.video_call_starts_at', null)
      .is('users.ghosted_at', null)
      .is('users.blocked_for_good_at', null);
   if (error) throw new Error(error.message);

   const sent: Sent[] = [];
   const would: Array<Record<string, unknown>> = [];
   const seen = new Set<string>();
   for (const row of (data ?? []) as Array<NudgeRow & { users: { username: string | null; messenger_psid: string | null } }>) {
      const nudge = nudgeDue(row, now);
      if (!nudge) continue;
      // One reminder per person per run, even with two ✅ pre-screenings.
      if (seen.has(row.user_id)) continue;
      seen.add(row.user_id);
      if (opts.dry) {
         const person = row.users.messenger_psid ? await loadPerson(svc, row.users.messenger_psid) : null;
         would.push({ user_id: row.user_id, username: row.users.username, nudge, stage: person?.stage ?? null, same_account: person?.user?.id === row.user_id, book_here: person?.bookHere ?? null });
         continue;
      }
      // Claim it first (conditional on the count we read), so two runs never send the same one twice.
      const { data: claimed } = await svc
         .from('pre_screenings')
         .update({ book_nudges: nudge, book_nudged_at: new Date(now).toISOString() })
         .eq('id', row.id)
         .eq('book_nudges', nudge - 1)
         .select('id')
         .maybeSingle();
      if (!claimed) continue;
      try {
         const result = await sendOne(svc, row, nudge, row.users.messenger_psid);
         if (!result) {
            await svc.from('pre_screenings').update({ book_nudge_result: 'past_steps' }).eq('id', row.id);
            continue;
         }
         await svc.from('pre_screenings').update({ book_nudge_result: result.ways.join('+') || 'unreached' }).eq('id', row.id);
         sent.push({ userId: row.user_id, username: row.users.username, nudge, ...result });
      } catch (err) {
         console.error('bookCallNudge: send failed', row.user_id, err instanceof Error ? err.message : err);
      }
   }

   if (opts.dry) return { ok: true, dry: true, daytime: isDaytimeManila(now), would };

   if (sent.length) {
      const chat = await getAdminChatId(svc);
      if (chat) {
         const lines = sent.map((s) => {
            const how = s.ways.length ? s.ways.join(' + ') : '⚠️ could not reach them';
            return `• ${s.username ? `@${s.username}` : s.userId} — ${s.nudge === 1 ? '1st' : '2nd'} reminder (${how}${s.note ? `; ${s.note}` : ''})`;
         });
         await sendTelegramMessage(chat, ['📅 Book-your-call reminder sent (passed pre-screening, no call booked):', ...lines].join('\n'), {
            aboutUserIds: sent.map((s) => s.userId)
         }).catch((err: unknown) => console.error('bookCallNudge: telegram failed', err instanceof Error ? err.message : err));
      }
   }
   return { ok: true, sent: sent.length, people: sent.map((s) => ({ user_id: s.userId, nudge: s.nudge, ways: s.ways, note: s.note })) };
};
