// Indonesia's WhatsApp-first sign-up (George, 2026-10-25). Many Indonesians have WhatsApp but not the
// Messenger app, so the app asks for WhatsApp first (the wa.me link carries the code, which Messenger's
// links can't). Once WhatsApp is confirmed, the bot walks them through Facebook there, one short message
// per step (code, link to our chat, paste), and the app just says "continue on WhatsApp". Facebook stays required. When Facebook connects,
// the bot says so on WhatsApp and points to the next step in the app.
//
// Indonesia only (George): an Indonesian (+62) WhatsApp number, or a test account so the team can try it
// from anywhere. And only people who confirm WhatsApp BEFORE Facebook: everyone else connects Facebook
// first (WhatsApp is locked until then), so nothing changes for them.
import { MESSENGER_PAGE_ID, type SendPulseResult, sendWhatsAppText } from './sendpulse.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

export type WhatsAppFirstLocale = 'id' | 'en';

export const isIndonesianPhone = (phone: string | null | undefined) =>
   String(phone ?? '')
      .replace(/\D/g, '')
      .startsWith('62');
export const whatsappFirstApplies = (phone: string | null | undefined, isTest: boolean | null | undefined) =>
   isIndonesianPhone(phone) || isTest === true;
// The language they picked on WhatsApp (🇮🇩/🇬🇧 in the JADWAL flow, saved as users.preferred_locale)
// wins; otherwise +62 is Bahasa Indonesia and anyone else English.
export const whatsappFirstLocale = (phone: string | null | undefined, preferred?: string | null): WhatsAppFirstLocale =>
   preferred === 'id' || preferred === 'en' ? preferred : isIndonesianPhone(phone) ? 'id' : 'en';

// Lenders only read English, so a loan request in Bahasa can't be funded (George, 2026-10-25).
export const ENGLISH_REQUEST_NOTE: Record<WhatsAppFirstLocale, string> = {
   id: '📝 Penting: nanti tulis permintaan pinjamanmu dalam bahasa Inggris. Pemberi pinjaman kami hanya bisa membaca bahasa Inggris, jadi permintaan dalam bahasa lain tidak bisa diterima.',
   en: '📝 Important: write your loan request in English. Our lenders only read English, so requests in other languages can’t be accepted.'
};

/** 🇮🇩/🇬🇧 tapped in WhatsApp: remember it on their account (the site reads it too). */
export const setWhatsAppLocale = async (svc: Svc, contactId: string, raw: string) => {
   const locale = raw === 'id' || raw === 'en' ? raw : null;
   if (!locale) return { ok: false, error: 'bad_locale' };
   const { error } = await svc
      .from('users')
      .update({ preferred_locale: locale, preferred_locale_at: new Date().toISOString() })
      .eq('whatsapp_contact_id', contactId);
   if (error) console.error('[whatsapp-first] locale save failed', error.message);
   return { ok: !error, locale };
};

const CONTINUE_URL = 'https://moodeng.app/continue?via=whatsapp';
// The Facebook code they get on WhatsApp may be read later than the app's 30 minutes.
const CODE_TTL_MS = 24 * 60 * 60 * 1000;

// Messenger's web address: from Android Chrome (where WhatsApp opens links) it's the one link that reaches
// our chat; m.me does nothing there (2026-10-10 tests). It carries no code, so they paste it.
export const MESSENGER_CHAT_URL = `https://www.messenger.com/t/${MESSENGER_PAGE_ID}`;

// The Facebook steps as a short chat, one small message per step (George, 2026-10-27: a single long
// message left an Indonesian borrower stuck). The code goes alone so a long-press copies just the code.
export const facebookStepsMessages = (code: string, locale: WhatsAppFirstLocale): string[] =>
   locale === 'id'
      ? [
           '✅ WhatsApp kamu sudah terhubung!\n\nMulai sekarang kami pandu kamu di sini, langkah demi langkah. Kamu tidak perlu kembali ke aplikasi.',
           '⏳ Tunggu sebentar, kami siapkan kode Facebook-mu…',
           'Kami perlu menghubungkan Facebook-mu untuk verifikasi akun.\n\n*Langkah 1 dari 3*\nTekan lama kode di bawah ini, lalu ketuk *Salin* 👇',
           code,
           `*Langkah 2 dari 3*\nKetuk link ini. Chat Moodeng Credit di Messenger akan terbuka:\n${MESSENGER_CHAT_URL}`,
           '*Langkah 3 dari 3*\nTempel kodenya di chat itu, lalu ketuk *Kirim*.\n\nSelesai! Kami akan mengabarimu di sini begitu Facebook-mu terhubung ✅',
           'Tidak punya aplikasi Messenger, atau link-nya tidak terbuka? Balas *BANTUAN* di sini, tim kami akan membantumu.'
        ]
      : [
           '✅ Your WhatsApp is connected!\n\nFrom now on we’ll guide you here, step by step. You don’t need to go back to the app.',
           '⏳ One moment, getting your Facebook code ready…',
           'We need to connect your Facebook to verify your account.\n\n*Step 1 of 3*\nPress and hold the code below, then tap *Copy* 👇',
           code,
           `*Step 2 of 3*\nTap this link. Our Moodeng Credit chat opens in Messenger:\n${MESSENGER_CHAT_URL}`,
           '*Step 3 of 3*\nPaste the code in that chat, then tap *Send*.\n\nThat’s it! We’ll tell you here as soon as your Facebook is connected ✅',
           'No Messenger app, or the link doesn’t open? Reply *HELP* here and our team will help you.'
        ];

// A beat between messages so they arrive in order and read like someone typing.
const STEP_PAUSE_MS = 1500;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const facebookConnectedText = (locale: WhatsAppFirstLocale) =>
   locale === 'id'
      ? '✅ Facebook kamu sudah terhubung. Terima kasih!\n\n' +
        'Langkah berikutnya: ceritakan sedikit tentang dirimu di aplikasi (2 menit):\n' +
        CONTINUE_URL +
        '\n\nSetelah itu, balas JADWAL di sini untuk memilih waktu video call 15 menit.\n\n' +
        ENGLISH_REQUEST_NOTE.id
      : '✅ Your Facebook is connected. Thank you!\n\n' +
        'Next: tell us a little about yourself in the app (2 minutes):\n' +
        CONTINUE_URL +
        '\n\nThen reply JADWAL here to pick a time for the 15-minute video call.\n\n' +
        ENGLISH_REQUEST_NOTE.en;

const newCode = () => {
   const bytes = crypto.getRandomValues(new Uint8Array(3));
   return `MDNG-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()}`;
};

// The newest unused Facebook code with time left, or a fresh one (same shape and rules as
// start_contact_verification, but valid for a day). The app's Indonesian flow reuses it
// (start_or_reuse_messenger_code), so the code on WhatsApp and the one in the app are the same.
const facebookCodeFor = async (svc: Svc, userId: string): Promise<string | null> => {
   const { data: existing } = await svc
      .from('contact_verification_codes')
      .select('code, expires_at')
      .eq('user_id', userId)
      .eq('channel', 'messenger')
      .is('verified_at', null)
      .gt('expires_at', new Date(Date.now() + 10 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
   if (existing?.[0]?.code) {
      // The app made it (30 minutes): keep it alive for the WhatsApp message.
      await svc
         .from('contact_verification_codes')
         .update({ expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString() })
         .eq('code', existing[0].code)
         .eq('channel', 'messenger');
      return String(existing[0].code);
   }
   const code = newCode();
   await svc.from('contact_verification_codes').delete().eq('user_id', userId).eq('channel', 'messenger').is('verified_at', null);
   const { error } = await svc
      .from('contact_verification_codes')
      .insert({ user_id: userId, channel: 'messenger', code, expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString() });
   if (error) {
      console.error('[whatsapp-first] code insert failed', error.message);
      return null;
   }
   return code;
};

// deno-lint-ignore no-explicit-any
const stepsUser = async (svc: Svc, userId: string, phone: string | null): Promise<any | null> => {
   const { data: user } = await svc.from('users').select('messenger_verified_at, user_role, is_test, preferred_locale').eq('id', userId).maybeSingle();
   if (!user || user.messenger_verified_at || user.user_role === 'lender' || !whatsappFirstApplies(phone, user.is_test)) return null;
   return user;
};

/**
 * Will WhatsApp confirming now send the Facebook steps? The "Confirm WhatsApp" SendPulse flow reads this
 * (`wa_first` in the reply) and skips its own English "you're set, continue in the app" message, since
 * our first step message already says WhatsApp is connected, in their language.
 */
export const facebookStepsDue = async (svc: Svc, userId: string, phone: string | null) => {
   try {
      return (await stepsUser(svc, userId, phone)) !== null;
   } catch {
      return false;
   }
};

/** WhatsApp just confirmed: if Facebook isn't connected yet, send the Facebook steps and the code. */
export const sendFacebookStepsOnWhatsApp = async (svc: Svc, userId: string, contactId: string, phone: string | null) => {
   try {
      const user = await stepsUser(svc, userId, phone);
      if (!user) return;
      const code = await facebookCodeFor(svc, userId);
      if (!code) return;
      const locale = whatsappFirstLocale(phone, user.preferred_locale);
      const messages = facebookStepsMessages(code, locale);
      let result: SendPulseResult = { ok: true };
      for (const [i, text] of messages.entries()) {
         if (i > 0) await pause(STEP_PAUSE_MS);
         result = await sendWhatsAppText(contactId, text);
         if (!result.ok) break;
      }
      console.log(`[whatsapp-first] Facebook steps for ${userId.slice(0, 8)} (${locale}): ${result.ok ? 'sent' : (result as { reason: string }).reason}`);
   } catch (err) {
      console.error('[whatsapp-first] steps failed', err instanceof Error ? err.message : err);
   }
};

/** Facebook just connected: tell people who did WhatsApp first, on WhatsApp, and point to the next step. */
export const sendFacebookConnectedOnWhatsApp = async (svc: Svc, userId: string) => {
   try {
      const { data: user } = await svc
         .from('users')
         .select('whatsapp_contact_id, whatsapp_verified_at, whatsapp_number, messenger_verified_at, is_test, preferred_locale')
         .eq('id', userId)
         .maybeSingle();
      if (!user?.whatsapp_contact_id || !user.whatsapp_verified_at || !user.messenger_verified_at) return;
      if (!whatsappFirstApplies(user.whatsapp_number, user.is_test)) return;
      // WhatsApp first only (see the top of this file).
      if (new Date(user.whatsapp_verified_at).getTime() >= new Date(user.messenger_verified_at).getTime()) return;
      const sent = await sendWhatsAppText(user.whatsapp_contact_id, facebookConnectedText(whatsappFirstLocale(user.whatsapp_number, user.preferred_locale)));
      console.log(`[whatsapp-first] Facebook connected note for ${userId.slice(0, 8)}: ${sent.ok ? 'sent' : sent.reason}`);
   } catch (err) {
      console.error('[whatsapp-first] connected note failed', err instanceof Error ? err.message : err);
   }
};
