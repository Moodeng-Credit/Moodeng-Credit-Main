// Indonesia's WhatsApp bot books the 15-minute video call in the chat (George, 2026-10-25). The person
// sends JADWAL ("schedule"); the SendPulse flow "Book call (JADWAL)" asks sendpulse-messenger-verify
// whether they can book ({action:'wa_booking_start'}), then shows a fixed list of time windows
// (WhatsApp list rows can't be filled from our side). The row they tap comes back as
// {action:'wa_book', window}; we book the first free slot in that window through the same code as the
// app's booking page (callBooking.ts) and confirm it here. Indonesia only, like whatsappFirst.ts.
import { botStage, type BotUserRow } from './botNextStep.ts';
import { bookCall, listCallSlots } from './callBooking.ts';
import { isKycVerified, needsPreKycGate } from './preKycGate.ts';
import { sendWhatsAppText } from './sendpulse.ts';
import { whatsappFirstApplies, whatsappFirstLocale, type WhatsAppFirstLocale } from './whatsappFirst.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

// Western Indonesia Time, where most borrowers are (same clock as the team's Bangkok hours).
export const BOOKING_TIME_ZONE = 'Asia/Jakarta';
const APP_URL = 'https://moodeng.app/continue?via=whatsapp';

export type BookingWindow =
   | 'today'
   | 'tomorrow_morning'
   | 'tomorrow_afternoon'
   | 'tomorrow_evening'
   | 'day2_morning'
   | 'day2_afternoon'
   | 'day2_evening'
   | 'other';
export const BOOKING_WINDOWS: BookingWindow[] = [
   'today',
   'tomorrow_morning',
   'tomorrow_afternoon',
   'tomorrow_evening',
   'day2_morning',
   'day2_afternoon',
   'day2_evening',
   'other'
];

// The WhatsApp list rows (fixed text in the SendPulse flow): what the tapped row says → its window.
// The flow saves the reply and sends it as `window`, so either the row title or the id works.
const ROW_TITLES: Record<string, BookingWindow> = {
   'hari ini': 'today',
   'besok pagi': 'tomorrow_morning',
   'besok siang': 'tomorrow_afternoon',
   'besok malam': 'tomorrow_evening',
   'lusa pagi': 'day2_morning',
   'lusa siang': 'day2_afternoon',
   'lusa malam': 'day2_evening',
   'waktu lain': 'other',
   today: 'today',
   'tomorrow morning': 'tomorrow_morning',
   'tomorrow afternoon': 'tomorrow_afternoon',
   'tomorrow evening': 'tomorrow_evening',
   'other time': 'other'
};
export const toBookingWindow = (raw: string): BookingWindow => {
   const text = raw.trim().toLowerCase().replace(/\s+/g, ' ');
   if ((BOOKING_WINDOWS as string[]).includes(text)) return text as BookingWindow;
   return ROW_TITLES[text] ?? Object.entries(ROW_TITLES).find(([title]) => text.includes(title))?.[1] ?? 'other';
};

// Morning before 12:00, afternoon 12:00–17:00, evening from 17:00 (local time).
const PARTS = { morning: [0, 12 * 60], afternoon: [12 * 60, 17 * 60], evening: [17 * 60, 24 * 60] } as const;

const localDay = (ms: number, timeZone = BOOKING_TIME_ZONE) =>
   new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const localMinutes = (ms: number, timeZone = BOOKING_TIME_ZONE) => {
   const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms));
   const value = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
   return value('hour') * 60 + value('minute');
};

/** Does this slot start fall inside the window, as of `now`? */
export const inWindow = (slotIso: string, window: BookingWindow, now: number): boolean => {
   const ms = Date.parse(slotIso);
   if (Number.isNaN(ms) || ms <= now || window === 'other') return false;
   const dayOffset = window === 'today' ? 0 : window.startsWith('tomorrow') ? 1 : 2;
   if (localDay(ms) !== localDay(now + dayOffset * 86_400_000)) return false;
   if (window === 'today') return true;
   const part = window.split('_')[1] as keyof typeof PARTS;
   const minutes = localMinutes(ms);
   return minutes >= PARTS[part][0] && minutes < PARTS[part][1];
};

/** The earliest free slot in the window, or null. */
export const pickSlot = (slots: string[], window: BookingWindow, now: number): string | null =>
   [...slots].filter((s) => inWindow(s, window, now)).sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;

export const formatCallTime = (iso: string, locale: WhatsAppFirstLocale) => {
   const date = new Date(iso);
   const day = new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-GB', {
      timeZone: BOOKING_TIME_ZONE,
      weekday: 'long',
      day: 'numeric',
      month: 'short'
   }).format(date);
   const time = new Intl.DateTimeFormat('en-GB', { timeZone: BOOKING_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
   return `${day}, ${time} WIB`;
};

const TEXT = {
   notIndonesia: {
      id: 'Pemesanan lewat WhatsApp belum tersedia untuk akunmu. Pilih waktu di aplikasi Moodeng:\n' + APP_URL,
      en: 'Booking on WhatsApp isn’t available for your account yet. Pick a time in the Moodeng app:\n' + APP_URL
   },
   notLinked: {
      id: 'Kami belum menemukan akun Moodeng untuk nomor ini. Daftar atau masuk di aplikasi, lalu hubungkan WhatsApp:\n' + APP_URL,
      en: 'We can’t find a Moodeng account for this number yet. Sign up or log in, then connect WhatsApp:\n' + APP_URL
   },
   facebookFirst: {
      id: 'Hubungkan Facebook dulu ya (lihat langkah yang kami kirim sebelumnya). Setelah itu, balas JADWAL lagi.',
      en: 'Please connect Facebook first (see the steps we sent earlier). Then reply JADWAL again.'
   },
   aboutFirst: {
      id: 'Satu langkah lagi sebelum video call: ceritakan sedikit tentang dirimu di aplikasi (2 menit):\n' + APP_URL + '\nSetelah itu, balas JADWAL di sini.',
      en: 'One step before the video call: tell us a little about yourself in the app (2 minutes):\n' + APP_URL + '\nThen reply JADWAL here.'
   },
   noCallNeeded: {
      id: 'Kamu tidak perlu video call lagi. Lanjutkan di aplikasi Moodeng:\n' + APP_URL,
      en: 'You don’t need a video call anymore. Continue in the Moodeng app:\n' + APP_URL
   },
   walletFirst: {
      id: 'Selesaikan pendaftaran di aplikasi dulu (buat dompetmu), lalu balas JADWAL di sini:\n' + APP_URL,
      en: 'Finish signing up in the app first (set up your wallet), then reply JADWAL here:\n' + APP_URL
   },
   other: {
      id: 'Pilih waktu yang cocok di kalender kami:\n' + APP_URL,
      en: 'Pick a time that suits you on our calendar:\n' + APP_URL
   },
   cooldown: {
      id: 'Kamu belum bisa memesan video call baru saat ini karena panggilan sebelumnya terlewat. Coba lagi nanti, atau balas pesan ini untuk bantuan.',
      en: 'You can’t book a new call just yet because earlier calls were missed. Try again later, or reply here for help.'
   },
   failed: {
      id: 'Maaf, pemesanan gagal. Balas JADWAL untuk mencoba lagi, atau pilih waktu di aplikasi:\n' + APP_URL,
      en: 'Sorry, the booking didn’t go through. Reply JADWAL to try again, or pick a time in the app:\n' + APP_URL
   }
} as const;

export const bookedText = (startIso: string, joinUrl: string | null, locale: WhatsAppFirstLocale) =>
   locale === 'id'
      ? `✅ Video call kamu sudah terjadwal:\n${formatCallTime(startIso, locale)} (15 menit)\n\n` +
        (joinUrl ? `Link Zoom:\n${joinUrl}\n\n` : '') +
        'Siapkan KTP dan tempat yang tenang. Mau ganti waktu? Balas JADWAL.'
      : `✅ Your video call is booked:\n${formatCallTime(startIso, locale)} (15 minutes)\n\n` +
        (joinUrl ? `Zoom link:\n${joinUrl}\n\n` : '') +
        'Have your ID ready and find a quiet spot. Need another time? Reply JADWAL.';

export const nearestText = (slots: string[], locale: WhatsAppFirstLocale) => {
   const list = slots.map((s) => `• ${formatCallTime(s, locale)}`).join('\n');
   return locale === 'id'
      ? `Tidak ada waktu kosong di jam itu. Waktu terdekat yang kosong:\n${list}\n\nBalas JADWAL untuk memilih lagi.`
      : `Nothing free at that time. The nearest free times:\n${list}\n\nReply JADWAL to pick again.`;
};

const USER_COLUMNS =
   'id, email, user_role, wallet_address, messenger_verified_at, whatsapp_verified_at, whatsapp_number, income_type, loan_access_status, is_didit, is_world_id, didit_id_status, didit_submitted_at, video_call_outcome, is_test';

type BookingUser = BotUserRow & {
   id: string;
   email: string | null;
   whatsapp_number: string | null;
   video_call_outcome: string | null;
   is_test: boolean | null;
};

/** Who this WhatsApp contact is, and whether they can book; null reason = they can. */
const whoCanBook = async (svc: Svc, contactId: string) => {
   const { data } = await svc.from('users').select(USER_COLUMNS).eq('whatsapp_contact_id', contactId).limit(1).maybeSingle();
   const user = data as BookingUser | null;
   if (!user) return { user: null, locale: 'id' as WhatsAppFirstLocale, reason: 'notLinked' as const };
   const locale = whatsappFirstLocale(user.whatsapp_number);
   if (!whatsappFirstApplies(user.whatsapp_number, user.is_test)) return { user, locale, reason: 'notIndonesia' as const };
   if (isKycVerified(user) || user.user_role === 'lender') return { user, locale, reason: 'noCallNeeded' as const };
   const gated = await needsPreKycGate(svc, user.id);
   const stage = botStage(user, gated, 0);
   if (stage === 'wallet') return { user, locale, reason: 'walletFirst' as const };
   if (!user.messenger_verified_at) return { user, locale, reason: 'facebookFirst' as const };
   if (stage === 'about') return { user, locale, reason: 'aboutFirst' as const };
   if (stage === 'book_call' || stage === 'call_booked') return { user, locale, reason: null };
   return { user, locale, reason: 'noCallNeeded' as const };
};

/** JADWAL: can this person book here? Says why not on WhatsApp; the flow shows the windows on can_book 1. */
export const startWhatsAppBooking = async (svc: Svc, contactId: string): Promise<{ can_book: 0 | 1; reason: string | null }> => {
   const { locale, reason } = await whoCanBook(svc, contactId);
   if (reason) {
      await sendWhatsAppText(contactId, TEXT[reason][locale]);
      return { can_book: 0, reason };
   }
   return { can_book: 1, reason: null };
};

/** A tapped window: book its first free slot and confirm, or offer the nearest free times. */
export const bookFromWindow = async (svc: Svc, contactId: string, rawWindow: string, now = Date.now()) => {
   const { user, locale, reason } = await whoCanBook(svc, contactId);
   if (!user || reason) {
      await sendWhatsAppText(contactId, TEXT[reason ?? 'notLinked'][locale]);
      return { ok: false, error: reason ?? 'not_linked' };
   }
   const window = toBookingWindow(rawWindow);
   if (window === 'other') {
      await sendWhatsAppText(contactId, TEXT.other[locale]);
      return { ok: true, other: true };
   }

   const listed = await listCallSlots(svc, { id: user.id, email: user.email }, BOOKING_TIME_ZONE);
   if (listed.body.error === 'cooldown') {
      await sendWhatsAppText(contactId, TEXT.cooldown[locale]);
      return { ok: false, error: 'cooldown' };
   }
   const slots = Array.isArray(listed.body.slots) ? (listed.body.slots as string[]) : [];
   const slot = pickSlot(slots, window, now);
   if (!slot) {
      const nearest = slots.filter((s) => Date.parse(s) > now).sort((a, b) => Date.parse(a) - Date.parse(b)).slice(0, 3);
      await sendWhatsAppText(contactId, nearest.length ? nearestText(nearest, locale) : TEXT.other[locale]);
      return { ok: false, error: 'no_slot' };
   }

   const booked = await bookCall(svc, { id: user.id, email: user.email }, slot, BOOKING_TIME_ZONE);
   if (booked.body.ok !== true) {
      console.error(`[whatsapp-booking] book failed for ${user.id.slice(0, 8)}:`, JSON.stringify(booked.body));
      await sendWhatsAppText(contactId, TEXT.failed[locale]);
      return { ok: false, error: String(booked.body.error ?? 'book_failed') };
   }
   const { data: saved } = await svc.from('users').select('video_call_starts_at, video_call_join_url').eq('id', user.id).maybeSingle();
   await sendWhatsAppText(contactId, bookedText(saved?.video_call_starts_at ?? slot, saved?.video_call_join_url ?? null, locale));
   return { ok: true, start: saved?.video_call_starts_at ?? slot };
};
