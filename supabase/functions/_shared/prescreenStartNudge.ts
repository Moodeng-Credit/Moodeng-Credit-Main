// Finish-your-pre-screening reminder (George 2026-11-23). Everyone new is on the pre-screening path
// (prescreen_all, #1611): Facebook first, then /screen. Some connect Facebook and never come back. On
// Android, Messenger's "Back to Moodeng" link opens a browser they aren't signed in on, and one
// borrower gave up there 20 seconds after connecting. 6 of 39 Messenger-connected people in the week
// to 2026-11-23 never sent a pre-screening, and nothing reminded them.
//
// loan-access action=start_nudge (pg_cron, hourly) sends at most two reminders per person:
//   1st  ≥ 1h after they connected Facebook (or WhatsApp)
//   2nd  ≥ 24h after the 1st
// only 09:00–21:00 Manila, only within 7 days of connecting, and only while they haven't sent the
// pre-screening (no row, or a row still 'open'). Each goes out on Messenger (link to /continue, which
// signs them in if needed and sends them on to /screen), as a push, as a text (no links, UniSMS) and
// on WhatsApp (follow-up template) when they have it. One Telegram line per run tells the team.
//
// Switch: telegram_bot_settings.prescreen_start_nudge = 'off' stops it (anything else = on).
// Dry run: {"action":"start_nudge","dry":true} lists who would get which, sends nothing.
import { firstNameOf, WA_PERSON_COLUMNS, type WaPerson, whatsAppTarget } from './bookCallLink.ts';
import { isDaytimeManila } from './bookCallNudge.ts';
import { getAdminChatId, SITE_URL } from './loanAccess.ts';
import { toBotLocale } from './messengerSupport.ts';
import { sendPushToUser } from './pushDelivery.ts';
import { FOLLOW_UP_TEMPLATE, sendMessengerMessage, sendWhatsAppTemplateTo } from './sendpulse.ts';
import { sendTelegramMessage } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export const FIRST_AFTER_MS = 3600000;
export const SECOND_AFTER_MS = 24 * 3600000;
export const GIVE_UP_AFTER_MS = 7 * 86400000;
export const MAX_NUDGES = 2;

export const continueUrl = (via: 'nudge' | 'push' | 'whatsapp') => `${SITE_URL}/continue?via=${via}`;

export type StartNudgeUser = {
   id: string;
   messenger_verified_at: string | null;
   whatsapp_verified_at: string | null;
   prescreen_start_nudges: number | null;
   prescreen_start_nudged_at: string | null;
};

/** When they connected Facebook (or WhatsApp): the clock for the reminders. Pure. */
export const connectedAt = (u: Pick<StartNudgeUser, 'messenger_verified_at' | 'whatsapp_verified_at'>): number => {
   const times = [u.messenger_verified_at, u.whatsapp_verified_at].map((t) => Date.parse(t ?? '')).filter((t) => !Number.isNaN(t));
   return times.length ? Math.min(...times) : NaN;
};

/** Which reminder (1 or 2) is due now, or null. `submitted` = they sent a pre-screening. Pure. */
export const startNudgeDue = (u: StartNudgeUser, submitted: boolean, now: number): 1 | 2 | null => {
   if (submitted) return null;
   const connected = connectedAt(u);
   if (Number.isNaN(connected) || now - connected > GIVE_UP_AFTER_MS) return null;
   const sent = u.prescreen_start_nudges ?? 0;
   if (sent >= MAX_NUDGES) return null;
   if (sent === 0) return now - connected >= FIRST_AFTER_MS ? 1 : null;
   const last = Date.parse(u.prescreen_start_nudged_at ?? '');
   return !Number.isNaN(last) && now - last >= SECOND_AFTER_MS ? 2 : null;
};

const LEAD: Record<1 | 2, { en: string; fil: string }> = {
   1: {
      en: "👋 You're almost in! Next: a few questions about your work and income (about 10 minutes). Then you book your call.",
      fil: '👋 Malapit ka na! Susunod: ilang tanong tungkol sa trabaho at kita mo (mga 10 minuto). Tapos mag-book ka ng call.'
   },
   2: {
      en: '👋 Your spot is still open! Finish the short questions about your work and income, then you can book your call.',
      fil: '👋 Bukas pa ang slot mo! Tapusin ang maikling tanong tungkol sa trabaho at kita mo, tapos puwede ka nang mag-book ng call.'
   }
};

const SIGN_IN_HINT = {
   en: 'Asked to sign in? Use the number or email you signed up with, we text you a code.',
   fil: 'Pinapa-sign in ka? Gamitin ang number o email na ginamit mo, ite-text namin ang code.'
};

/** The Messenger text. Pure. */
export const startNudgeText = (nudge: 1 | 2, locale: 'en' | 'fil', firstName: string | null) =>
   `${firstName ? `Hi ${firstName}! ` : ''}${LEAD[nudge][locale]}\n\n👉 ${continueUrl('nudge')}\n${SIGN_IN_HINT[locale]}`;

/** {{2}} of the WhatsApp follow-up template: one line, no new lines (Meta refuses them). Pure. */
export const startNudgeWhatsAppText = (nudge: 1 | 2) =>
   (nudge === 1
      ? "You're almost in! Next is a few questions about your work and income (about 10 minutes), then you book your call. "
      : 'Your spot is still open! Finish the short questions about your work and income, then you can book your call. ') +
   `Open ${continueUrl('whatsapp')} and sign in with the number or email you signed up with.`;

type Candidate = StartNudgeUser & {
   username: string | null;
   display_name: string | null;
   messenger_psid: string | null;
   preferred_locale: string | null;
} & WaPerson;

type Sent = { userId: string; username: string | null; nudge: 1 | 2; ways: string[]; note: string };

const sendOne = async (svc: SupabaseClient, u: Candidate, nudge: 1 | 2): Promise<{ ways: string[]; note: string }> => {
   const locale = toBotLocale(u.preferred_locale);
   const first = (u.display_name ?? '').trim().split(/\s+/)[0] || null;
   const target = whatsAppTarget(u);
   const [messenger, push, sms, whatsapp] = await Promise.all([
      u.messenger_psid
         ? sendMessengerMessage(u.messenger_psid, {
              text: startNudgeText(nudge, locale, first),
              card: {
                 title: locale === 'fil' ? 'Ituloy sa Moodeng' : 'Continue on Moodeng',
                 button: { title: locale === 'fil' ? 'Ituloy' : 'Continue', url: `${continueUrl('nudge')}&lang=${locale}` }
              }
           }).then(
              (r: { ok: boolean }) => r.ok,
              () => false
           )
         : Promise.resolve(false),
      sendPushToUser(svc, u.id, () => ({
         type: 'loan_access_decision',
         title: nudge === 1 ? "You're almost in ✍️" : 'Your spot is still open ✍️',
         body: 'A few questions about your work and income, then you book your call.',
         url: continueUrl('push'),
         tag: 'prescreen-start-nudge'
      })).catch(() => null),
      svc.rpc('prescreen_start_sms', { p_user: u.id, p_nudge: nudge }).then(
         ({ data }: { data: unknown }) => (typeof data === 'string' ? data : 'failed'),
         () => 'failed'
      ),
      target
         ? sendWhatsAppTemplateTo(target, {
              name: FOLLOW_UP_TEMPLATE.name,
              language: FOLLOW_UP_TEMPLATE.language,
              params: [firstNameOf(u.display_name, u.username), startNudgeWhatsAppText(nudge)]
           }).then(
              (r: { ok: boolean }) => r.ok,
              () => false
           )
         : Promise.resolve(false)
   ]);
   const pushed = Boolean(push && (push as { sent?: number }).sent);
   const texted = sms === 'sent' || sms === 'unconfirmed';
   const ways = [messenger ? 'Messenger' : null, whatsapp ? 'WhatsApp' : null, pushed ? 'push' : null, texted ? 'text' : null].filter(
      Boolean
   ) as string[];
   const note =
      sms === 'rejected_network' ? 'no text: Smart/TNT/Sun' : sms === 'no_number' ? 'no number to text' : sms === 'off' ? 'texts off' : '';
   return { ways, note };
};

export const runPrescreenStartNudges = async (svc: SupabaseClient, now = Date.now(), opts: { dry?: boolean } = {}) => {
   const { data: setting } = await svc.from('telegram_bot_settings').select('value').eq('key', 'prescreen_start_nudge').maybeSingle();
   if (
      !opts.dry &&
      String(setting?.value ?? '')
         .trim()
         .toLowerCase() === 'off'
   )
      return { ok: true, skipped: 'off', sent: 0 };
   if (!opts.dry && !isDaytimeManila(now)) return { ok: true, skipped: 'night', sent: 0 };

   const since = new Date(now - GIVE_UP_AFTER_MS).toISOString();
   const { data, error } = await svc
      .from('users')
      .select(
         `id, username, display_name, messenger_psid, preferred_locale, messenger_verified_at, whatsapp_verified_at, prescreen_start_nudges, prescreen_start_nudged_at, ${WA_PERSON_COLUMNS}`
      )
      .eq('prescreen_path', true)
      .eq('is_test', false)
      .eq('loan_access_status', 'none')
      .eq('account_status', 'active')
      .neq('user_role', 'lender')
      .is('ghosted_at', null)
      .is('blocked_for_good_at', null)
      .lt('prescreen_start_nudges', MAX_NUDGES)
      .or(`messenger_verified_at.gte.${since},whatsapp_verified_at.gte.${since}`);
   if (error) throw new Error(error.message);
   const people = (data ?? []) as Candidate[];
   if (!people.length)
      return opts.dry ? { ok: true, dry: true, daytime: isDaytimeManila(now), would: [] } : { ok: true, sent: 0, people: [] };

   // Sent = any pre-screening past 'open' (sent / graded / failed), or one the team already decided.
   const { data: rows, error: rowsError } = await svc
      .from('pre_screenings')
      .select('user_id, status, team_decision')
      .in(
         'user_id',
         people.map((p) => p.id)
      );
   if (rowsError) throw new Error(rowsError.message);
   const submitted = new Set<string>();
   const started = new Set<string>();
   for (const r of (rows ?? []) as Array<{ user_id: string; status: string | null; team_decision: string | null }>) {
      started.add(r.user_id);
      if ((r.status && r.status !== 'open') || r.team_decision) submitted.add(r.user_id);
   }

   const sent: Sent[] = [];
   const would: Array<Record<string, unknown>> = [];
   for (const u of people) {
      const nudge = startNudgeDue(u, submitted.has(u.id), now);
      if (!nudge) continue;
      if (opts.dry) {
         would.push({
            user_id: u.id,
            username: u.username,
            nudge,
            started: started.has(u.id),
            messenger: Boolean(u.messenger_psid),
            whatsapp: Boolean(whatsAppTarget(u))
         });
         continue;
      }
      // Claim it first (conditional on the count we read), so two runs never send the same one twice.
      const { data: claimed } = await svc
         .from('users')
         .update({ prescreen_start_nudges: nudge, prescreen_start_nudged_at: new Date(now).toISOString() })
         .eq('id', u.id)
         .eq('prescreen_start_nudges', nudge - 1)
         .select('id')
         .maybeSingle();
      if (!claimed) continue;
      try {
         const result = await sendOne(svc, u, nudge);
         await svc
            .from('users')
            .update({ prescreen_start_nudge_result: result.ways.join('+') || 'unreached' })
            .eq('id', u.id);
         sent.push({ userId: u.id, username: u.username, nudge, ...result });
      } catch (err) {
         console.error('prescreenStartNudge: send failed', u.id, err instanceof Error ? err.message : err);
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
         await sendTelegramMessage(
            chat,
            ['✍️ Finish-your-pre-screening reminder sent (connected Facebook, no pre-screening yet):', ...lines].join('\n'),
            {
               aboutUserIds: sent.map((s) => s.userId)
            }
         ).catch((err: unknown) => console.error('prescreenStartNudge: telegram failed', err instanceof Error ? err.message : err));
      }
   }
   return { ok: true, sent: sent.length, people: sent.map((s) => ({ user_id: s.userId, nudge: s.nudge, ways: s.ways, note: s.note })) };
};
