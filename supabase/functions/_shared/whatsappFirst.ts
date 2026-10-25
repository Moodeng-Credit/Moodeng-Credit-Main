// Indonesia's WhatsApp-first sign-up (George, 2026-10-25). Many Indonesians have WhatsApp but not the
// Messenger app, so the app asks for WhatsApp first (the wa.me link carries the code, which Messenger's
// links can't). Once WhatsApp is confirmed, the bot sends the Facebook steps there: a code, a link to
// our chat, and what to do if the link doesn't open. Facebook stays required. When Facebook connects,
// the bot says so on WhatsApp and points to the next step in the app.
//
// Indonesia only (George): an Indonesian (+62) WhatsApp number, or a test account so the team can try it
// from anywhere. And only people who confirm WhatsApp BEFORE Facebook: everyone else connects Facebook
// first (WhatsApp is locked until then), so nothing changes for them.
import { buildMessengerVerifyLink, sendWhatsAppText } from './sendpulse.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

export type WhatsAppFirstLocale = 'id' | 'en';

export const isIndonesianPhone = (phone: string | null | undefined) =>
   String(phone ?? '')
      .replace(/\D/g, '')
      .startsWith('62');
export const whatsappFirstApplies = (phone: string | null | undefined, isTest: boolean | null | undefined) =>
   isIndonesianPhone(phone) || isTest === true;
// +62 is Indonesia: Bahasa Indonesia. A tester elsewhere gets English.
export const whatsappFirstLocale = (phone: string | null | undefined): WhatsAppFirstLocale => (isIndonesianPhone(phone) ? 'id' : 'en');

const CONTINUE_URL = 'https://moodeng.app/continue?via=whatsapp';
// The Facebook code they get on WhatsApp may be read later than the app's 30 minutes.
const CODE_TTL_MS = 24 * 60 * 60 * 1000;

export const facebookStepsText = (link: string, locale: WhatsAppFirstLocale) =>
   locale === 'id'
      ? '✅ WhatsApp kamu sudah terhubung!\n\n' +
        'Langkah berikutnya: hubungkan Facebook. Kami perlu ini untuk verifikasi akunmu.\n\n' +
        '1. Salin kode di pesan berikutnya.\n' +
        `2. Ketuk link ini untuk membuka chat Moodeng Credit:\n${link}\n` +
        '3. Tempel kodenya di chat, lalu Kirim.\n\n' +
        'Link tidak terbuka? Buka aplikasi Facebook, cari "Moodeng Credit", ketuk Kirim Pesan, lalu kirim kodenya.\n\n' +
        'Butuh bantuan? Balas pesan ini.'
      : '✅ Your WhatsApp is connected!\n\n' +
        'Next: connect Facebook. We need it to verify your account.\n\n' +
        '1. Copy the code in the next message.\n' +
        `2. Tap this link to open our Moodeng Credit chat:\n${link}\n` +
        '3. Paste the code in the chat, then Send.\n\n' +
        'Link doesn’t open? Open the Facebook app, search "Moodeng Credit", tap Message, and send the code.\n\n' +
        'Need help? Reply to this message.';

export const facebookConnectedText = (locale: WhatsAppFirstLocale) =>
   locale === 'id'
      ? '✅ Facebook kamu sudah terhubung. Terima kasih!\n\n' +
        'Lanjutkan di aplikasi Moodeng: ceritakan sedikit tentang dirimu, lalu pilih jadwal video call 15 menit.\n' +
        CONTINUE_URL
      : '✅ Your Facebook is connected. Thank you!\n\n' +
        'Continue in the Moodeng app: tell us a little about yourself, then book a 15-minute video call.\n' +
        CONTINUE_URL;

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

/** WhatsApp just confirmed: if Facebook isn't connected yet, send the Facebook steps and the code. */
export const sendFacebookStepsOnWhatsApp = async (svc: Svc, userId: string, contactId: string, phone: string | null) => {
   try {
      const { data: user } = await svc.from('users').select('messenger_verified_at, user_role, is_test').eq('id', userId).maybeSingle();
      if (!user || user.messenger_verified_at || user.user_role === 'lender' || !whatsappFirstApplies(phone, user.is_test)) return;
      const code = await facebookCodeFor(svc, userId);
      if (!code) return;
      const locale = whatsappFirstLocale(phone);
      const steps = await sendWhatsAppText(contactId, facebookStepsText(buildMessengerVerifyLink(code), locale));
      // The code on its own, so a long-press copies just the code.
      const codeSent = steps.ok ? await sendWhatsAppText(contactId, code) : steps;
      console.log(`[whatsapp-first] Facebook steps for ${userId.slice(0, 8)} (${locale}): ${codeSent.ok ? 'sent' : codeSent.reason}`);
   } catch (err) {
      console.error('[whatsapp-first] steps failed', err instanceof Error ? err.message : err);
   }
};

/** Facebook just connected: tell people who did WhatsApp first, on WhatsApp, and point to the next step. */
export const sendFacebookConnectedOnWhatsApp = async (svc: Svc, userId: string) => {
   try {
      const { data: user } = await svc
         .from('users')
         .select('whatsapp_contact_id, whatsapp_verified_at, whatsapp_number, messenger_verified_at, is_test')
         .eq('id', userId)
         .maybeSingle();
      if (!user?.whatsapp_contact_id || !user.whatsapp_verified_at || !user.messenger_verified_at) return;
      if (!whatsappFirstApplies(user.whatsapp_number, user.is_test)) return;
      // WhatsApp first only (see the top of this file).
      if (new Date(user.whatsapp_verified_at).getTime() >= new Date(user.messenger_verified_at).getTime()) return;
      const sent = await sendWhatsAppText(user.whatsapp_contact_id, facebookConnectedText(whatsappFirstLocale(user.whatsapp_number)));
      console.log(`[whatsapp-first] Facebook connected note for ${userId.slice(0, 8)}: ${sent.ok ? 'sent' : sent.reason}`);
   } catch (err) {
      console.error('[whatsapp-first] connected note failed', err instanceof Error ? err.message : err);
   }
};
