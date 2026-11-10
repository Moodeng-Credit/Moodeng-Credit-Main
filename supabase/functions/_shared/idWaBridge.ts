// Indonesia track: the WhatsApp → Telegram bridge (migration 20261110120000_id_whatsapp_bridge.sql).
//
// Facebook post → moodeng.app/id → "Chat di WhatsApp" opens WhatsApp with a message already typed
// ("… MDNG-DAFTAR-A"). They tap send. Because THEY wrote first, we may reply freely for 24 hours:
//
//   WhatsApp:  hello → step 1 install Telegram → step 2 tap moodeng.app/t/<token> (opens our bot)
//   Telegram:  /start wa_<token> → welcome + "▶️ Mulai daftar" (a login_url button: Telegram signs them
//              in on the site, join_id_track() copies the WhatsApp number onto the account)
//   Nudges:    WhatsApp at 20 min and 3 h (still not in Telegram; the second one also pings the team),
//              Telegram at 30 min and 20 h (pressed Start, never tapped the button).
//
// Nothing here needs them to go back to the Facebook page: people who leave that browser don't return.
//
// RULE (George, 2026-11-10): WhatsApp messages never talk about loans or money. They only lead to
// Telegram. idWaBridge.test.ts fails if a WhatsApp text here mentions them.
//
// Switch: telegram_bot_settings.id_wa_bridge = off | test | on (off = this file answers nothing).
// Never throws.
import { ID_SITE_URL, notifyIdNextStep } from './idTrack.ts';
import { getWhatsAppContact, normalizeWhatsAppPhone, sendWhatsAppText } from './sendpulse.ts';
import { callTelegramApi, sendTelegramMessage, type TelegramInlineKeyboard } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

export type BridgeLocale = 'id' | 'en';
export type BridgeOs = 'a' | 'i' | null;

export const TELEGRAM_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=org.telegram.messenger';
export const TELEGRAM_APP_STORE_URL = 'https://apps.apple.com/app/telegram-messenger/id686449807';

/** We may send free text for 24h after their last message; stop an hour early to be safe. */
export const WA_WINDOW_MS = 23 * 60 * 60 * 1000;
const WA_NUDGE_1_AFTER_MS = 20 * 60 * 1000;
const WA_NUDGE_2_AFTER_MS = 3 * 60 * 60 * 1000;
const TG_NUDGE_1_AFTER_MS = 30 * 60 * 1000;
const TG_NUDGE_2_AFTER_MS = 20 * 60 * 60 * 1000;
const MAX_NUDGES = 2;
/** The same message sent twice in a row (double tap) gets one set of steps. */
const RESEND_GAP_MS = 90 * 1000;
const STEP_PAUSE_MS = 1300;
const BATCH = 40;

// ── the typed message ────────────────────────────────────────────────────────────────────────────
/**
 * "… MDNG-DAFTAR-A" (Bahasa, Android) / "MDNG-JOIN-I" (English, iPhone) / "MDNG-DAFTAR" (unknown phone).
 * Lenient about spaces, case and a missing dash, because people retype it. Null = not a bridge message.
 */
export const parseBridgeKeyword = (raw: string | null | undefined): { locale: BridgeLocale; os: BridgeOs } | null => {
   const match = /\bMDNG[\s-]*(DAFTAR|JOIN)(?:[\s-]+([AI]))?(?![A-Za-z0-9])/i.exec(String(raw ?? ''));
   if (!match) return null;
   const os = match[2]?.toLowerCase();
   return { locale: match[1].toUpperCase() === 'JOIN' ? 'en' : 'id', os: os === 'a' || os === 'i' ? os : null };
};

/** [A-Za-z0-9_-]{22}: fits Telegram's 64-character /start payload after "wa_". */
export const newBridgeToken = (): string => {
   const raw = new Uint8Array(16);
   crypto.getRandomValues(raw);
   return btoa(String.fromCharCode(...raw))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
};
export const isBridgeToken = (value: string | null | undefined): value is string => /^[A-Za-z0-9_-]{16,40}$/.test(String(value ?? ''));

/** Our own short link (a 302 to the bot). WhatsApp once made Telegram links untappable, so the main step uses this. */
export const bridgeLink = (token: string) => `${ID_SITE_URL}/t/${token}`;
/** Straight to the bot, as the backup in the nudge. */
export const botStartLink = (botUsername: string, token: string) => `https://t.me/${botUsername}?start=wa_${token}`;

// ── WhatsApp copy (never about loans or money) ───────────────────────────────────────────────────
const storeLines = (os: BridgeOs, l: BridgeLocale): string =>
   os === 'a'
      ? TELEGRAM_PLAY_STORE_URL
      : os === 'i'
        ? TELEGRAM_APP_STORE_URL
        : l === 'id'
          ? `Android: ${TELEGRAM_PLAY_STORE_URL}\n\niPhone: ${TELEGRAM_APP_STORE_URL}`
          : `Android: ${TELEGRAM_PLAY_STORE_URL}\n\niPhone: ${TELEGRAM_APP_STORE_URL}`;

/** The steps, one small message each (a single long message left a borrower stuck, 2026-10-27). */
export const bridgeStepsMessages = (token: string, l: BridgeLocale, os: BridgeOs): string[] =>
   l === 'id'
      ? [
           '👋 Halo! Ini *Moodeng* (moodeng.app).\n\nKami pandu kamu di sini, langkah demi langkah.\n\n🔒 Kami TIDAK PERNAH minta PIN, password, atau kode OTP kamu.',
           `*Langkah 1 dari 2*\nPasang aplikasi *Telegram* (gratis), lalu buat akun di sana dengan nomor HP kamu.\n👇\n${storeLines(os, l)}\n\nSudah punya Telegram? Langsung ke langkah 2.`,
           `*Langkah 2 dari 2*\nSetelah Telegram siap, ketuk link ini.\nLalu tekan *START* (MULAI) di bagian bawah layar.\n👇\n${bridgeLink(token)}`,
           'Bingung? Balas *BANTUAN* di sini. Tim kami akan bantu kamu. 🙋'
        ]
      : [
           '👋 Hi! This is *Moodeng* (moodeng.app).\n\nWe’ll guide you here, step by step.\n\n🔒 We NEVER ask for your PIN, password or OTP code.',
           `*Step 1 of 2*\nInstall the *Telegram* app (free), then make an account there with your phone number.\n👇\n${storeLines(os, l)}\n\nAlready have Telegram? Go straight to step 2.`,
           `*Step 2 of 2*\nWhen Telegram is ready, tap this link.\nThen tap *START* at the bottom of the screen.\n👇\n${bridgeLink(token)}`,
           'Stuck? Reply *HELP* here. Our team will help you. 🙋'
        ];

export const bridgeNudgeText = (n: 1 | 2, token: string, botUsername: string, l: BridgeLocale): string =>
   l === 'id'
      ? n === 1
         ? `👋 Sudah pasang Telegram?\n\nKetuk link ini, lalu tekan *START*:\n${bridgeLink(token)}\n\nLink tidak terbuka? Coba yang ini:\n${botStartLink(botUsername, token)}\n\nBingung? Balas *BANTUAN*.`
         : `Kami masih menunggu kamu di Telegram 🙂\n\nKetuk link ini, lalu tekan *START*:\n${bridgeLink(token)}\n\nAda kendala? Balas *BANTUAN*, tim kami bantu kamu di sini.`
      : n === 1
        ? `👋 Got Telegram installed?\n\nTap this link, then tap *START*:\n${bridgeLink(token)}\n\nLink not opening? Try this one:\n${botStartLink(botUsername, token)}\n\nStuck? Reply *HELP*.`
        : `We’re still waiting for you on Telegram 🙂\n\nTap this link, then tap *START*:\n${bridgeLink(token)}\n\nAny trouble? Reply *HELP* and our team will help you here.`;

export const bridgeArrivedText = (l: BridgeLocale): string =>
   l === 'id' ? '✅ Kamu sudah sampai di Telegram! Lanjut di sana ya. 👍' : '✅ You made it to Telegram! Carry on there. 👍';

export const bridgeAlreadyText = (botUsername: string, l: BridgeLocale): string =>
   l === 'id'
      ? `Kamu sudah terdaftar 🙂 Lanjut di Telegram ya:\nhttps://t.me/${botUsername}`
      : `You’re already signed up 🙂 Carry on in Telegram:\nhttps://t.me/${botUsername}`;

// ── Telegram copy ────────────────────────────────────────────────────────────────────────────────
const JOIN_URL = `${ID_SITE_URL}/auth/telegram/callback?track=id`;

/** Welcome in the bot. The button is a Telegram login_url: it signs in whoever taps it, on our site. */
export const bridgeWelcome = (l: BridgeLocale, again = false): { text: string; keyboard: TelegramInlineKeyboard } => ({
   text:
      l === 'id'
         ? again
            ? '👋 Tinggal satu ketukan lagi.\n\nTekan tombol di bawah untuk mulai daftar. 👇'
            : '👋 Selamat datang di Moodeng!\n\nPinjaman kecil $5–$10, bayar dalam rupiah.\nKami pandu kamu di chat ini, satu langkah setiap kali.\n\nTekan tombol di bawah untuk mulai. 👇'
         : again
           ? '👋 Just one more tap.\n\nTap the button below to start signing up. 👇'
           : '👋 Welcome to Moodeng!\n\nSmall loans of $5–$10, repaid in rupiah.\nWe guide you in this chat, one step at a time.\n\nTap the button below to start. 👇',
   keyboard: [[{ text: l === 'id' ? '▶️ Mulai daftar' : '▶️ Start sign-up', login_url: { url: JOIN_URL, request_write_access: true } }]]
});

// ── which nudge is due ───────────────────────────────────────────────────────────────────────────
export type BridgeRow = {
   id: string;
   token: string;
   contact_id: string;
   phone: string | null;
   locale: string | null;
   os: string | null;
   last_inbound_at: string;
   steps_sent_at: string | null;
   wa_nudges: number;
   wa_nudged_at: string | null;
   telegram_id: number | string | null;
   telegram_username: string | null;
   started_at: string | null;
   tg_nudges: number;
   tg_nudged_at: string | null;
   user_id: string | null;
};

const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN);
const localeOf = (row: Pick<BridgeRow, 'locale'>): BridgeLocale => (row.locale === 'en' ? 'en' : 'id');
const osOf = (row: Pick<BridgeRow, 'os'>): BridgeOs => (row.os === 'a' || row.os === 'i' ? row.os : null);

/** Still on WhatsApp (no Start yet): nudge 1 after 20 min, nudge 2 after 3 h, only inside the 24h window. */
export const waNudgeDue = (row: BridgeRow, now: number): 1 | 2 | null => {
   if (row.user_id || row.telegram_id || row.wa_nudges >= MAX_NUDGES) return null;
   if (!(now - ms(row.last_inbound_at) < WA_WINDOW_MS)) return null;
   if (row.wa_nudges === 0) return now - ms(row.steps_sent_at ?? row.last_inbound_at) >= WA_NUDGE_1_AFTER_MS ? 1 : null;
   return now - ms(row.wa_nudged_at) >= WA_NUDGE_2_AFTER_MS ? 2 : null;
};

/** Pressed Start but never tapped the button: nudge 1 after 30 min, nudge 2 after 20 h. */
export const tgNudgeDue = (row: BridgeRow, now: number): 1 | 2 | null => {
   if (row.user_id || !row.telegram_id || row.tg_nudges >= MAX_NUDGES) return null;
   if (row.tg_nudges === 0) return now - ms(row.started_at) >= TG_NUDGE_1_AFTER_MS ? 1 : null;
   return now - ms(row.tg_nudged_at) >= TG_NUDGE_2_AFTER_MS ? 2 : null;
};

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────
const pause = (millis: number) => new Promise((resolve) => setTimeout(resolve, millis));
const background = async (work: Promise<unknown>) => {
   if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(work);
   else await work;
};
const logErr = (what: string, err: unknown) => console.error(`[idWaBridge] ${what}`, err instanceof Error ? err.message : err);

const ROW_COLUMNS =
   'id, token, contact_id, phone, locale, os, last_inbound_at, steps_sent_at, wa_nudges, wa_nudged_at, telegram_id, telegram_username, started_at, tg_nudges, tg_nudged_at, user_id';

export const bridgeSwitch = async (svc: Svc): Promise<'off' | 'test' | 'on'> => {
   try {
      const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', 'id_wa_bridge').maybeSingle();
      const value = String((data as { value?: string } | null)?.value ?? '').trim();
      return value === 'on' || value === 'test' ? value : 'off';
   } catch {
      return 'off';
   }
};

let cachedBot: string | null = null;
/** The bot's real @username (the env default is not the live bot). */
export const bridgeBotUsername = async (): Promise<string> => {
   if (cachedBot) return cachedBot;
   try {
      const me = await callTelegramApi<{ username?: string }>('getMe', {});
      if (me?.username) cachedBot = me.username;
   } catch (err) {
      logErr('getMe failed', err);
   }
   return cachedBot ?? (Deno.env.get('TELEGRAM_BOT_USERNAME') ?? 'moodengnewbranchbot').trim().replace(/^@/, '');
};

const teamChat = async (svc: Svc): Promise<string | null> => {
   try {
      const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', 'kyc_alert_chat_id').maybeSingle();
      return String((data as { value?: string } | null)?.value ?? '').trim() || null;
   } catch {
      return null;
   }
};

const phoneLabel = (phone: string | null) => (phone ? `+${phone}` : 'unknown number');
const chatLink = (phone: string | null) => (phone ? `\nChat: https://wa.me/${phone}` : '');

/** One line for the team (KYC group). Never throws. */
const tellTeam = async (svc: Svc, text: string) => {
   try {
      const chat = await teamChat(svc);
      if (chat) await sendTelegramMessage(chat, text);
   } catch (err) {
      logErr('team post failed', err);
   }
};

const sendSteps = async (row: BridgeRow) => {
   const messages = bridgeStepsMessages(row.token, localeOf(row), osOf(row));
   for (let i = 0; i < messages.length; i += 1) {
      if (i > 0) await pause(STEP_PAUSE_MS);
      const result = await sendWhatsAppText(row.contact_id, messages[i]);
      if (!result.ok) {
         console.error(`[idWaBridge] step ${i + 1} to ${row.contact_id.slice(0, 6)} not sent: ${result.reason}`);
         return false;
      }
   }
   return true;
};

// ── WhatsApp side ────────────────────────────────────────────────────────────────────────────────
/**
 * A WhatsApp message that came through the SendPulse "MDNG" flow. Returns null when it is not a bridge
 * message (or the bridge is off) so the caller carries on with its code check; otherwise the JSON for
 * the flow (`wa_first: 1` makes the flow skip its own English reply).
 */
export const handleBridgeInbound = async (
   svc: Svc,
   input: { contactId: string; message: string; phone?: string | null },
   nowIso = new Date().toISOString()
): Promise<Record<string, unknown> | null> => {
   const parsed = parseBridgeKeyword(input.message);
   if (!parsed) return null;
   try {
      if ((await bridgeSwitch(svc)) === 'off') return null;
      const now = new Date(nowIso).getTime();

      const { data: found } = await svc.from('id_wa_bridge').select(ROW_COLUMNS).eq('contact_id', input.contactId).maybeSingle();
      let row = (found as BridgeRow | null) ?? null;

      // Someone already on the track (joined before, or this contact is on an Indonesia account): point to Telegram.
      const { data: owner } = await svc
         .from('users')
         .select('id, market')
         .eq('whatsapp_contact_id', input.contactId)
         .limit(1)
         .maybeSingle();
      if (row?.user_id || (owner as { market?: string | null } | null)?.market === 'ID') {
         if (row) await svc.from('id_wa_bridge').update({ last_inbound_at: nowIso }).eq('id', row.id);
         await background(bridgeBotUsername().then((bot) => sendWhatsAppText(input.contactId, bridgeAlreadyText(bot, parsed.locale))));
         return { ok: true, wa_first: 1, already: 0, bridge: 'already' };
      }

      const fresh = !row;
      if (!row) {
         const contact = await getWhatsAppContact(input.contactId);
         const phone = normalizeWhatsAppPhone(contact?.channel_data?.phone) ?? normalizeWhatsAppPhone(input.phone);
         const { data: made, error } = await svc
            .from('id_wa_bridge')
            .insert({
               token: newBridgeToken(),
               contact_id: input.contactId,
               phone,
               locale: parsed.locale,
               os: parsed.os,
               last_inbound_at: nowIso
            })
            .select(ROW_COLUMNS)
            .maybeSingle();
         if (error || !made) {
            // Two webhooks at once: the other one made the row and is sending the steps.
            if (error && /duplicate|unique/i.test(error.message ?? '')) return { ok: true, wa_first: 1, already: 1, bridge: 'repeat' };
            logErr('insert failed', error?.message ?? 'no row');
            return null;
         }
         row = made as BridgeRow;
      }

      // Sent twice in a row: one set of steps.
      if (!fresh && row.steps_sent_at && now - ms(row.steps_sent_at) < RESEND_GAP_MS) {
         await svc.from('id_wa_bridge').update({ last_inbound_at: nowIso }).eq('id', row.id);
         return { ok: true, wa_first: 1, already: 1, bridge: 'repeat' };
      }

      // Claim the send before sending, so overlapping webhooks can't both send.
      const claim = svc
         .from('id_wa_bridge')
         .update({ last_inbound_at: nowIso, steps_sent_at: nowIso, locale: parsed.locale, ...(parsed.os ? { os: parsed.os } : {}) })
         .eq('id', row.id);
      const { data: claimed } = await (row.steps_sent_at ? claim.eq('steps_sent_at', row.steps_sent_at) : claim.is('steps_sent_at', null))
         .select('id')
         .maybeSingle();
      if (!claimed) return { ok: true, wa_first: 1, already: 1, bridge: 'repeat' };

      const current: BridgeRow = { ...row, locale: parsed.locale, os: parsed.os ?? row.os };
      await background(
         (async () => {
            const sent = await sendSteps(current);
            if (fresh) {
               const phoneOs = current.os === 'a' ? ' · Android' : current.os === 'i' ? ' · iPhone' : '';
               await tellTeam(
                  svc,
                  `🇮🇩 New sign-up started on WhatsApp: ${phoneLabel(current.phone)}${phoneOs}\n${sent ? 'Steps to Telegram sent.' : '⚠️ Steps NOT delivered — message them by hand.'}${chatLink(current.phone)}`
               );
            }
         })().catch((err) => logErr('steps failed', err))
      );
      return { ok: true, wa_first: 1, already: 0, bridge: fresh ? 'started' : 'resent' };
   } catch (err) {
      logErr('inbound failed', err);
      return null;
   }
};

/** moodeng.app/t/<token> → the bot. A bad token still lands on the bot (it shows its normal start). */
export const bridgeRedirectUrl = async (token: string | null | undefined): Promise<string> => {
   const bot = await bridgeBotUsername();
   return isBridgeToken(token) ? botStartLink(bot, token) : `https://t.me/${bot}`;
};

// ── Telegram side ────────────────────────────────────────────────────────────────────────────────
type TgFrom = { id?: number; username?: string; first_name?: string; language_code?: string };

/**
 * "/start wa_<token>" in a private chat with the bot. Ties the Telegram account to the WhatsApp row and
 * sends the welcome with the sign-up button. Someone already on the track gets their WhatsApp attached
 * and their next step. Always answers (an unknown or someone else's token still gets the welcome).
 */
export const handleBridgeStart = async (svc: Svc, message: { chat: { id: number }; from?: TgFrom }, payload: string): Promise<void> => {
   const from = message.from;
   const chatId = from?.id ?? message.chat.id;
   const token = payload.replace(/^wa_/, '').trim();
   const nowIso = new Date().toISOString();
   let row: BridgeRow | null = null;
   try {
      if (isBridgeToken(token) && from?.id) {
         // The first Telegram account to press Start owns the row.
         const { data } = await svc
            .from('id_wa_bridge')
            .update({ telegram_id: from.id, ...(from.username ? { telegram_username: from.username } : {}) })
            .eq('token', token)
            .or(`telegram_id.is.null,telegram_id.eq.${from.id}`)
            .select(ROW_COLUMNS)
            .maybeSingle();
         row = (data as BridgeRow | null) ?? null;
         if (row && !row.started_at) await svc.from('id_wa_bridge').update({ started_at: nowIso }).eq('id', row.id).is('started_at', null);
      }
      const locale: BridgeLocale = row ? localeOf(row) : (from?.language_code ?? 'id').toLowerCase().startsWith('en') ? 'en' : 'id';
      const firstStart = Boolean(row && !row.started_at);

      // Already on the Indonesia track with this Telegram: attach WhatsApp and show what's next.
      const existing = from?.id
         ? ((
              await svc
                 .from('users')
                 .select('id')
                 .or(`chat_id.eq.${from.id},telegram_id.eq.${from.id}`)
                 .eq('market', 'ID')
                 .limit(1)
                 .maybeSingle()
           ).data as { id: string } | null)
         : null;
      if (existing) {
         if (row) await svc.rpc('attach_id_wa_bridge', { p_user_id: existing.id });
         if (!(await notifyIdNextStep(svc, existing.id, 'whatsapp'))) {
            const welcome = bridgeWelcome(locale, true);
            await sendTelegramMessage(chatId, welcome.text, { inlineKeyboard: welcome.keyboard });
         }
      } else {
         const welcome = bridgeWelcome(locale);
         await sendTelegramMessage(chatId, welcome.text, { inlineKeyboard: welcome.keyboard });
      }

      if (row && firstStart) {
         if (Date.now() - ms(row.last_inbound_at) < WA_WINDOW_MS) await sendWhatsAppText(row.contact_id, bridgeArrivedText(locale));
         const who = from?.username ? ` (@${from.username})` : '';
         await tellTeam(svc, `🇮🇩 ${phoneLabel(row.phone)} reached Telegram${who}. Waiting for them to tap "Mulai daftar".`);
      }
   } catch (err) {
      logErr('start failed', err);
      try {
         const welcome = bridgeWelcome('id');
         await sendTelegramMessage(chatId, welcome.text, { inlineKeyboard: welcome.keyboard });
      } catch (sendErr) {
         logErr('welcome fallback failed', sendErr);
      }
   }
};

// ── nudges (runs inside video-call-reminders, every 5 minutes) ───────────────────────────────────
/** Returns how many nudges went out. Each is claimed (conditional update on the counter) before sending. */
export const runIdWaBridgeNudges = async (svc: Svc, now = Date.now()): Promise<{ whatsapp: number; telegram: number }> => {
   const tally = { whatsapp: 0, telegram: 0 };
   try {
      if ((await bridgeSwitch(svc)) === 'off') return tally;
      const nowIso = new Date(now).toISOString();

      // Still on WhatsApp.
      const { data: waiting } = await svc
         .from('id_wa_bridge')
         .select(ROW_COLUMNS)
         .is('user_id', null)
         .is('telegram_id', null)
         .lt('wa_nudges', MAX_NUDGES)
         .gt('last_inbound_at', new Date(now - WA_WINDOW_MS).toISOString())
         .order('last_inbound_at', { ascending: true })
         .limit(BATCH);
      const bot = (waiting ?? []).length ? await bridgeBotUsername() : '';
      for (const row of (waiting ?? []) as BridgeRow[]) {
         const due = waNudgeDue(row, now);
         if (!due) continue;
         const { data: claimed } = await svc
            .from('id_wa_bridge')
            .update({ wa_nudges: row.wa_nudges + 1, wa_nudged_at: nowIso })
            .eq('id', row.id)
            .eq('wa_nudges', row.wa_nudges)
            .is('telegram_id', null)
            .select('id')
            .maybeSingle();
         if (!claimed) continue;
         const result = await sendWhatsAppText(row.contact_id, bridgeNudgeText(due, row.token, bot, localeOf(row)));
         if (result.ok) tally.whatsapp += 1;
         // The second nudge is the last thing the bot can do: hand them to a person.
         if (due === 2 || !result.ok) {
            await tellTeam(
               svc,
               `🇮🇩 ${phoneLabel(row.phone)} started on WhatsApp and has not reached Telegram.${result.ok ? '' : ' ⚠️ Our reminder was NOT delivered.'}\nPlease message them by hand.${chatLink(row.phone)}`
            );
         }
      }

      // In Telegram, never tapped the button.
      const { data: started } = await svc
         .from('id_wa_bridge')
         .select(ROW_COLUMNS)
         .is('user_id', null)
         .not('telegram_id', 'is', null)
         .lt('tg_nudges', MAX_NUDGES)
         .order('started_at', { ascending: true })
         .limit(BATCH);
      for (const row of (started ?? []) as BridgeRow[]) {
         const due = tgNudgeDue(row, now);
         if (!due) continue;
         // Joined some other way since: attach and leave the queue.
         const { data: joined } = await svc
            .from('users')
            .select('id')
            .or(`chat_id.eq.${row.telegram_id},telegram_id.eq.${row.telegram_id}`)
            .eq('market', 'ID')
            .limit(1)
            .maybeSingle();
         if (joined) {
            await svc.rpc('attach_id_wa_bridge', { p_user_id: (joined as { id: string }).id });
            await svc.from('id_wa_bridge').update({ tg_nudges: MAX_NUDGES }).eq('id', row.id);
            continue;
         }
         const { data: claimed } = await svc
            .from('id_wa_bridge')
            .update({ tg_nudges: row.tg_nudges + 1, tg_nudged_at: nowIso })
            .eq('id', row.id)
            .eq('tg_nudges', row.tg_nudges)
            .is('user_id', null)
            .select('id')
            .maybeSingle();
         if (!claimed) continue;
         try {
            const welcome = bridgeWelcome(localeOf(row), true);
            await sendTelegramMessage(row.telegram_id as number | string, welcome.text, { inlineKeyboard: welcome.keyboard });
            tally.telegram += 1;
         } catch (err) {
            logErr('telegram nudge failed', err);
         }
      }
   } catch (err) {
      logErr('nudges failed', err);
   }
   return tally;
};
