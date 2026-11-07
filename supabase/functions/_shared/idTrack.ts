// Indonesia track (users.market = 'ID', docs/INDONESIA_TRACK.md): Indonesians do everything through
// Telegram, so our one bot (TELEGRAM_API_TOKEN) messages them about every step and every loan event,
// in Bahasa Indonesia (English when users.preferred_locale = 'en'), short, with one button to the
// right page. WhatsApp is notifications + humans only: no bot conversation (see the two WhatsApp texts
// at the bottom).
//
// Where they are comes from one place: the SQL function id_onboarding_status(uuid) (migration
// 20261107120000_indonesia_track.sql). Everything here is best-effort: it never throws, it logs.
//
// This file must stay a leaf (it only imports telegram.ts): loanAccess.ts, callBooking.ts,
// borrowerNotificationDelivery.ts and others import it.
import { sendTelegramMessage, type TelegramInlineKeyboard } from './telegram.ts';

// deno-lint-ignore no-explicit-any
type Svc = any;

export const ID_SITE_URL = (Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('MOODENG_APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://moodeng.app').replace(/\/$/, '');
export const idAppUrl = (path: string) => `${ID_SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

// Their time zone: Western Indonesia Time.
export const ID_TIME_ZONE = 'Asia/Jakarta';

export const ID_STEPS = ['telegram', 'whatsapp', 'facebook', 'about', 'income', 'kyc', 'walt', 'call'] as const;
export type IdStep = (typeof ID_STEPS)[number];
export type IdNext = IdStep | 'apply' | 'waiting';
export type IdLocale = 'id' | 'en';

export type IdStatus = {
   market: 'ID' | null;
   steps?: Record<IdStep, boolean>;
   messenger?: boolean;
   facebookProfile?: boolean;
   incomeState?: string | null;
   kycApproved?: boolean;
   kycState?: string | null;
   access?: string;
   readyForKyc?: boolean;
   readyForCall?: boolean;
   next?: IdNext;
};

export const isIdStep = (value: unknown): value is IdStep => typeof value === 'string' && (ID_STEPS as readonly string[]).includes(value);

/** 🇮🇩 mark for team/lender posts. */
export const idFlag = (market: string | null | undefined) => (market === 'ID' ? '🇮🇩 ' : '');

export const idLocaleOf = (preferred: string | null | undefined): IdLocale => (preferred === 'en' ? 'en' : 'id');

/** Is this person on the Indonesia track? False on any error (the default flow is the safe one). */
export const isIdTrackUser = async (svc: Svc, userId: string | null | undefined): Promise<boolean> => {
   if (!userId) return false;
   try {
      const { data, error } = await svc.from('users').select('market').eq('id', userId).maybeSingle();
      if (error) return false;
      return (data as { market?: string | null } | null)?.market === 'ID';
   } catch {
      return false;
   }
};

/** id_onboarding_status(uuid) — null on error. `market` is null for everyone not on the track. */
export const loadIdStatus = async (svc: Svc, userId: string): Promise<IdStatus | null> => {
   try {
      const { data, error } = await svc.rpc('id_onboarding_status', { p_user_id: userId });
      if (error) {
         console.error('[idTrack] id_onboarding_status failed', error.message);
         return null;
      }
      return (data as IdStatus | null) ?? null;
   } catch (err) {
      console.error('[idTrack] id_onboarding_status failed', err instanceof Error ? err.message : err);
      return null;
   }
};

export const stepsLeft = (status: IdStatus | null | undefined) => (status?.steps ? ID_STEPS.filter((s) => !status.steps![s]).length : 0);

export const idStepUrl = (next: IdNext | null | undefined) =>
   next === 'apply' ? idAppUrl('/request-board') : next && next !== 'waiting' ? idAppUrl(`/id/onboarding?step=${next}`) : idAppUrl('/id/onboarding');

const STEP_LABEL: Record<IdLocale, Record<IdStep, string>> = {
   id: {
      telegram: 'Telegram',
      whatsapp: 'WhatsApp',
      facebook: 'Facebook',
      about: 'Tentang kamu',
      income: 'Bukti penghasilan',
      kyc: 'Verifikasi KTP & wajah',
      walt: 'Alamat Walt',
      call: 'Jadwal video call'
   },
   en: {
      telegram: 'Telegram',
      whatsapp: 'WhatsApp',
      facebook: 'Facebook',
      about: 'About you',
      income: 'Proof of income',
      kyc: 'ID + face check',
      walt: 'Walt address',
      call: 'Book the video call'
   }
};

// What to do next, one line each.
const NEXT_LINE: Record<IdLocale, Record<IdNext, string>> = {
   id: {
      telegram: 'Hubungkan Telegram.',
      whatsapp: 'Hubungkan WhatsApp (+62).',
      facebook: 'Hubungkan Facebook: kirim kode ke Messenger kami, tempel link profilmu, dan ikuti Page kami.',
      about: 'Ceritakan sedikit tentang dirimu (2 menit).',
      income: 'Kirim bukti penghasilan (mutasi rekening, e-wallet, atau slip gaji).',
      kyc: 'Verifikasi KTP dan wajah (3 menit).',
      walt: 'Tempel alamat Walt kamu (USDC, BNB Chain / BEP20).',
      call: 'Pilih waktu video call 15 menit dengan tim.',
      apply: 'Kamu sudah disetujui! Ajukan pinjaman pertamamu.',
      waiting: 'Tunggu kabar dari tim setelah video call.'
   },
   en: {
      telegram: 'Connect Telegram.',
      whatsapp: 'Connect WhatsApp (+62).',
      facebook: 'Connect Facebook: send the code to our Messenger, paste your profile link and follow our Page.',
      about: 'Tell us a little about yourself (2 minutes).',
      income: 'Send proof of income (bank or e-wallet history, or a payslip).',
      kyc: 'Verify your ID and face (3 minutes).',
      walt: 'Paste your Walt address (USDC, BNB Chain / BEP20).',
      call: 'Pick a time for the 15-minute video call with the team.',
      apply: 'You’re approved! Request your first loan.',
      waiting: 'We’ll message you after the video call.'
   }
};

const NEXT_BUTTON: Record<IdLocale, Record<IdNext, string>> = {
   id: {
      telegram: 'Hubungkan Telegram',
      whatsapp: 'Hubungkan WhatsApp',
      facebook: 'Hubungkan Facebook',
      about: 'Isi sekarang',
      income: 'Kirim dokumen',
      kyc: 'Verifikasi sekarang',
      walt: 'Tempel alamat Walt',
      call: 'Pilih waktu',
      apply: 'Ajukan pinjaman',
      waiting: 'Buka Moodeng'
   },
   en: {
      telegram: 'Connect Telegram',
      whatsapp: 'Connect WhatsApp',
      facebook: 'Connect Facebook',
      about: 'Fill it in',
      income: 'Send document',
      kyc: 'Verify now',
      walt: 'Paste Walt address',
      call: 'Pick a time',
      apply: 'Request a loan',
      waiting: 'Open Moodeng'
   }
};

// Bahasa versions of the "please resend" reasons (incomeDocs.ts RESEND_TEXT).
const RESEND_ID: Record<string, string> = {
   password_protected: 'PDF-mu dikunci kata sandi. Kirim screenshot riwayat transaksimu saja.',
   scanned_pdf: 'PDF-mu tidak bisa kami baca. Kirim screenshot riwayat transaksimu saja.',
   unsupported_file: 'Jenis foto itu tidak bisa dibuka. Kirim screenshot atau foto JPG/PNG.',
   unreadable: 'Dokumennya kurang jelas. Foto ulang di tempat terang, 4 sudut terlihat dan angkanya tajam.',
   not_financial: 'Ini bukan mutasi rekening, riwayat e-wallet, atau slip gaji. Kirim salah satunya.',
   old_document: 'Dokumen ini lebih dari 2 bulan. Kirim yang terbaru.',
   short_history: 'Riwayatnya terlalu pendek. Kirim 2–3 bulan terakhir.',
   no_income: 'Kami tidak melihat uang masuk. Kirim riwayat yang menunjukkan penghasilanmu.'
};

export type IdEvent =
   | 'step_done'
   | 'next_step'
   | 'nudge'
   | 'kyc_approved'
   | 'kyc_review'
   | 'kyc_declined'
   | 'kyc_abandoned'
   | 'income_approved'
   | 'income_declined'
   | 'income_resend'
   | 'call_booked'
   | 'call_moved'
   | 'call_reminder_day'
   | 'call_confirm'
   | 'call_hour'
   | 'call_starting'
   | 'call_waiting'
   | 'access_approved'
   | 'access_rejected'
   | 'call_no_show'
   | 'call_cancelled'
   | 'call_released'
   | 'no_show_corrected'
   | 'access_expired'
   | 'attended_kyc_pending'
   | 'loan_posted'
   | 'loan_funded'
   | 'loan_funded_walt'
   | 'cashout_walt'
   | 'due_soon'
   | 'due_tomorrow'
   | 'due_today'
   | 'overdue'
   | 'repaid'
   | 'request_expired';

export type IdEventData = {
   doneStep?: IdStep | null;
   next?: IdNext | null;
   stepsLeft?: number;
   reason?: string | null;
   triesLeft?: number | null;
   /** ISO time of the call; shown in WIB. */
   callAt?: string | null;
   joinUrl?: string | null;
   confirmUrl?: string | null;
   amount?: number | string | null;
   /** Indonesia rupiah peg: rupiah owed (left, or paid for 'repaid'). Shown as "Rp 110.000 (≈ $6.08)"
    *  on due_soon / due_tomorrow / due_today / overdue / repaid when set; `amount` is the USD today. */
   amountIdr?: number | string | null;
   /** Loan due date (ISO); shown in WIB. */
   dueAt?: string | null;
   /** Overdue: how late, e.g. "2 days". */
   lateBy?: string | null;
};

export type IdMessage = { text: string; button?: { text: string; url: string } };

const money = (value: number | string | null | undefined) => {
   const n = Number(value ?? 0);
   const fixed = Number.isFinite(n) ? n : 0;
   return `$${fixed % 1 === 0 ? fixed.toFixed(0) : fixed.toFixed(2)}`;
};

/** "Rp 110.000" — whole rupiah, Indonesian grouping (same as fxRates.formatIdr; kept here so this file stays a leaf). */
const formatIdr = (value: number | string) => `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(Number(value)))}`;

/** "Sabtu, 8 Nov, 14:00 WIB" / "Saturday, 8 Nov, 14:00 WIB". */
export const formatIdTime = (iso: string | null | undefined, locale: IdLocale) => {
   if (!iso || Number.isNaN(Date.parse(iso))) return '';
   const date = new Date(iso);
   const day = new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-GB', { timeZone: ID_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'short' }).format(date);
   const time = new Intl.DateTimeFormat('en-GB', { timeZone: ID_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
   return `${day}, ${time} WIB`;
};

/** "8 Nov" — a due date as a day in Jakarta. */
export const formatIdDay = (iso: string | null | undefined, locale: IdLocale) =>
   iso && !Number.isNaN(Date.parse(iso))
      ? new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-GB', { timeZone: ID_TIME_ZONE, day: 'numeric', month: 'short' }).format(new Date(iso))
      : '';

const say = (locale: IdLocale, id: string, en: string) => (locale === 'en' ? en : id);

const nextButton = (next: IdNext | null | undefined, locale: IdLocale) => {
   const n: IdNext = next ?? 'waiting';
   return { text: NEXT_BUTTON[locale][n], url: idStepUrl(n) };
};

/** The message for one event, in their language. Pure. */
export const buildIdMessage = (event: IdEvent, locale: IdLocale, data: IdEventData = {}): IdMessage => {
   const next = data.next ?? null;
   const nextLine = next ? `\n\n👉 ${say(locale, 'Langkah berikutnya', 'Next')}: ${NEXT_LINE[locale][next]}` : '';
   const amount = money(data.amount);
   // Pegged loans owe rupiah: lead with the rupiah, the USD is just today's equivalent.
   const owed = data.amountIdr != null && Number.isFinite(Number(data.amountIdr)) && Number(data.amountIdr) > 0 ? `${formatIdr(data.amountIdr)} (≈ ${amount})` : amount;
   const at = formatIdTime(data.callAt, locale);
   const due = formatIdDay(data.dueAt, locale);
   const join = data.joinUrl ? { text: say(locale, '🎥 Gabung video call', '🎥 Join the call'), url: data.joinUrl } : undefined;
   const repay = { text: say(locale, 'Bayar sekarang', 'Repay now'), url: idAppUrl('/repay') };
   const onboarding = { text: say(locale, 'Buka Moodeng', 'Open Moodeng'), url: idAppUrl('/id/onboarding') };
   const book = { text: say(locale, 'Pilih waktu baru', 'Pick a new time'), url: idAppUrl('/id/onboarding?step=call') };

   switch (event) {
      case 'step_done': {
         const done = data.doneStep ? STEP_LABEL[locale][data.doneStep] : say(locale, 'Langkah', 'Step');
         if (!next || next === 'waiting') {
            return { text: `✅ ${done} ${say(locale, 'selesai', 'done')}!${nextLine}`, button: onboarding };
         }
         return {
            text: `✅ ${done} ${say(locale, 'selesai — langkah berikutnya', 'done — next step')}: ${next === 'apply' ? NEXT_LINE[locale].apply : STEP_LABEL[locale][next as IdStep]}\n\n${NEXT_LINE[locale][next]}`,
            button: nextButton(next, locale)
         };
      }
      case 'next_step':
         return { text: `👉 ${say(locale, 'Langkah berikutnya', 'Next step')}: ${next ? NEXT_LINE[locale][next] : ''}`, button: nextButton(next, locale) };
      case 'nudge': {
         const left = data.stepsLeft ?? 0;
         return {
            text: say(
               locale,
               `👋 Tinggal ${left} langkah lagi sebelum kamu bisa meminjam!\n\n👉 Berikutnya: ${next ? NEXT_LINE.id[next] : ''}`,
               `👋 Only ${left} step${left === 1 ? '' : 's'} left before you can borrow!\n\n👉 Next: ${next ? NEXT_LINE.en[next] : ''}`
            ),
            button: nextButton(next, locale)
         };
      }
      case 'kyc_approved':
         return {
            text: `🎉 ${say(locale, 'KTP dan wajahmu sudah terverifikasi!', 'Your ID and face check is approved!')}${nextLine}`,
            button: next && next !== 'waiting' ? nextButton(next, locale) : onboarding
         };
      case 'kyc_review':
         return {
            text: say(
               locale,
               '🕐 Verifikasi KTP-mu sedang dicek manual oleh tim. Biasanya beberapa jam, paling lama 1 hari kerja. Kami kabari di sini. Sambil menunggu, kamu bisa lanjut ke langkah berikutnya.',
               '🕐 Your ID check is in manual review. It usually takes a few hours, at most 1 business day. We’ll tell you here. Meanwhile you can go on with the next step.'
            ) + nextLine,
            button: next && next !== 'waiting' ? nextButton(next, locale) : onboarding
         };
      case 'kyc_declined': {
         const tries = data.triesLeft;
         const reason = data.reason ? `\n${say(locale, 'Alasan', 'Reason')}: ${data.reason}` : '';
         const triesLine =
            tries != null && tries <= 0
               ? say(locale, '\n\nKesempatanmu sudah habis. Balas pesan ini, tim kami akan membantu.', '\n\nYou’ve used all your tries. Reply here and our team will help you.')
               : tries != null
                 ? say(locale, `\n\nSisa kesempatan: ${tries} dari 3. Pastikan KTP asli, terang, dan tidak terpotong.`, `\n\nTries left: ${tries} of 3. Use your original ID, in good light, nothing cut off.`)
                 : '';
         return {
            text: `❌ ${say(locale, 'Verifikasi KTP-mu belum berhasil.', 'Your ID check didn’t pass.')}${reason}${triesLine}`,
            button: tries != null && tries <= 0 ? onboarding : { text: say(locale, 'Coba lagi', 'Try again'), url: idAppUrl('/id/onboarding?step=kyc') }
         };
      }
      case 'kyc_abandoned':
         return {
            text: say(locale, '⏳ Verifikasi KTP-mu belum selesai. Hanya 3 menit, lanjutkan sekarang.', '⏳ Your ID check isn’t finished. It takes 3 minutes, pick it up now.'),
            button: { text: say(locale, 'Lanjutkan', 'Continue'), url: idAppUrl('/id/onboarding?step=kyc') }
         };
      case 'income_approved':
         return { text: `✅ ${say(locale, 'Bukti penghasilanmu disetujui. Terima kasih!', 'Your proof of income is approved. Thank you!')}${nextLine}`, button: next ? nextButton(next, locale) : onboarding };
      case 'income_resend':
         return {
            text: `📄 ${say(locale, 'Kirim ulang bukti penghasilanmu ya.', 'Please send your proof of income again.')}\n${data.reason ?? ''}`.trim(),
            button: { text: say(locale, 'Kirim lagi', 'Send again'), url: idAppUrl('/id/onboarding?step=income') }
         };
      case 'income_declined':
         return {
            text: `❌ ${say(locale, 'Bukti penghasilanmu belum bisa kami setujui.', 'We couldn’t approve your proof of income.')}${data.reason ? `\n${data.reason}` : ''}\n${say(locale, 'Kirim dokumen lain kapan saja.', 'Send a different one any time.')}`,
            button: { text: say(locale, 'Kirim lagi', 'Send again'), url: idAppUrl('/id/onboarding?step=income') }
         };
      case 'call_booked':
         return {
            text: say(
               locale,
               `📅 Video call kamu sudah terjadwal: ${at} (15 menit).\nSiapkan KTP asli dan tempat yang tenang. Kami ingatkan lagi sebelum mulai.`,
               `📅 Your video call is booked: ${at} (15 minutes).\nHave your original ID ready and find a quiet spot. We’ll remind you before it starts.`
            ),
            button: join ?? onboarding
         };
      case 'call_moved':
         return {
            text: say(locale, `🔄 Video call kamu dipindah ke ${at}.`, `🔄 Your video call moved to ${at}.`),
            button: join ?? onboarding
         };
      case 'call_reminder_day':
         return { text: say(locale, `⏰ Pengingat: video call kamu ${at}.`, `⏰ Reminder: your video call is ${at}.`), button: join ?? onboarding };
      case 'call_confirm':
         return {
            text: say(
               locale,
               `⏰ Video call kamu 1 jam lagi (${at}). Ketuk ✅ Saya akan hadir dalam 30 menit, kalau tidak jadwalnya dibatalkan otomatis.`,
               `⏰ Your video call is in 1 hour (${at}). Tap ✅ I’ll be there within 30 minutes, or it’s cancelled automatically.`
            ),
            button: data.confirmUrl ? { text: say(locale, '✅ Saya akan hadir', '✅ I’ll be there'), url: data.confirmUrl } : join ?? onboarding
         };
      case 'call_hour':
         return { text: say(locale, `⏰ Video call kamu kurang dari 1 jam lagi: ${at}. Siapkan KTP dan nyalakan kamera.`, `⏰ Your video call starts in under an hour: ${at}. Have your ID ready, camera on.`), button: join ?? onboarding };
      case 'call_starting':
         return { text: say(locale, '👋 Video call kamu dimulai sekarang. Ketuk untuk bergabung.', '👋 Your video call is starting now. Tap to join.'), button: join ?? onboarding };
      case 'call_waiting':
         return { text: say(locale, '🙂 Kami sudah menunggumu di video call. Ketuk untuk bergabung sekarang.', '🙂 We’re ready for you. Tap to join the call now.'), button: join ?? onboarding };
      case 'access_approved':
         return {
            text: say(
               locale,
               '🎉 Kamu disetujui! Sekarang kamu bisa mengajukan pinjaman pertamamu.\n⚠️ Bayar tepat waktu: keterlambatan dicatat dan akunmu bisa ditutup.',
               '🎉 You’re approved! You can now request your first loan.\n⚠️ Pay on time: late payments are recorded and can close your account.'
            ),
            button: { text: say(locale, 'Ajukan pinjaman', 'Request a loan'), url: idAppUrl('/request-board?applyLoan=1') }
         };
      case 'attended_kyc_pending':
         return {
            text: say(
               locale,
               '🙏 Terima kasih sudah ikut video call! Kami menunggu hasil verifikasi KTP-mu, lalu tim akan menyetujuimu. Kami kabari di sini.',
               '🙏 Thanks for joining the call! We’re waiting for your ID check result, then the team approves you. We’ll tell you here.'
            ),
            button: onboarding
         };
      case 'access_rejected':
         return {
            text: say(
               locale,
               'Maaf, pengajuanmu di Moodeng ditutup. Kalau ada pertanyaan, balas pesan ini.',
               'Sorry, your Moodeng application has been closed. If you have questions, reply here.'
            )
         };
      case 'call_no_show':
         return {
            text: say(locale, '😢 Kami tidak bertemu kamu di video call. Tidak apa-apa, pilih waktu baru.', '😢 We missed you on the call. No problem, pick a new time.'),
            button: book
         };
      case 'call_cancelled':
         return { text: say(locale, '📅 Video call kamu dibatalkan. Pilih waktu baru ya.', '📅 Your video call was cancelled. Please pick a new time.'), button: book };
      case 'call_released':
         return {
            text: say(locale, '📅 Kamu tidak konfirmasi tepat waktu, jadi video call dibatalkan. Pilih waktu baru.', '📅 You didn’t confirm in time, so the call was cancelled. Pick a new time.'),
            button: book
         };
      case 'no_show_corrected':
         return { text: say(locale, '🙏 Maaf atas kesalahan kami: kamu tercatat hadir di video call. Abaikan pesan sebelumnya.', '🙏 Sorry for the mix-up: you’re recorded as attending the call. Please ignore our earlier message.'), button: onboarding };
      case 'access_expired':
         return { text: say(locale, 'Masih mau meminjam di Moodeng? Pilih waktu video call dengan tim.', 'Still want to borrow with Moodeng? Book a call with the team.'), button: book };
      case 'loan_posted':
         return {
            text: say(
               locale,
               `📝 Permintaan ${amount} kamu sudah diposting. Kami kabari begitu ada pemberi pinjaman yang mendanai.`,
               `📝 Your ${amount} request is posted. We’ll tell you as soon as a lender funds it.`
            ),
            button: { text: say(locale, 'Lihat permintaan', 'See my request'), url: idAppUrl('/request-board') }
         };
      case 'loan_funded':
         return {
            text: say(
               locale,
               `🎉 Pinjaman ${amount} kamu sudah dikirim ke dompet Moodeng.${due ? ` Jatuh tempo ${due}.` : ''} Kirim ke Walt sekarang →`,
               `🎉 Your ${amount} loan was sent to your Moodeng wallet.${due ? ` Due ${due}.` : ''} Send it to Walt now →`
            ),
            button: { text: say(locale, 'Kirim ke Walt', 'Send to Walt'), url: idAppUrl('/withdraw?to=walt') }
         };
      case 'loan_funded_walt':
         return {
            text: say(
               locale,
               `💸 Pinjaman ${amount} kamu sudah dikirim ke Walt kamu (USDC, BNB Chain).${due ? ` Jatuh tempo ${due}.` : ''} Jual ke Rupiah di Walt P2P.`,
               `💸 Your ${amount} loan was sent to your Walt (USDC, BNB Chain).${due ? ` Due ${due}.` : ''} Sell it for Rupiah in Walt P2P.`
            ),
            button: { text: say(locale, 'Buka Walt', 'Open Walt'), url: 'https://t.me/wallet' }
         };
      case 'cashout_walt':
         return {
            text: say(locale, `💸 ${amount} dikirim ke Walt (BNB Chain). Jual USDT ke Rupiah di Walt P2P.`, `💸 ${amount} sent to Walt (BNB Chain). Sell USDT for Rupiah in Walt P2P.`)
         };
      case 'due_soon':
         return { text: say(locale, `⏰ Pembayaran ${owed} jatuh tempo${due ? ` ${due}` : ' sebentar lagi'}.`, `⏰ Your ${owed} payment is due${due ? ` ${due}` : ' soon'}.`), button: repay };
      case 'due_tomorrow':
         return { text: say(locale, `⏰ Pembayaran ${owed} jatuh tempo besok. Bayar tepat waktu untuk menjaga skor kreditmu.`, `⏰ Your ${owed} payment is due tomorrow. Pay on time to protect your credit.`), button: repay };
      case 'due_today':
         return { text: say(locale, `⚠️ Pembayaran ${owed} jatuh tempo hari ini.`, `⚠️ Your ${owed} payment is due today.`), button: repay };
      case 'overdue':
         return {
            text: say(
               locale,
               `🚨 Pembayaran ${owed} sudah terlambat${data.lateBy ? ` (${data.lateBy.replace(/days?/, 'hari')})` : ''}. Bayar sekarang untuk menjaga akunmu.`,
               `🚨 Your ${owed} payment is overdue${data.lateBy ? ` (${data.lateBy} late)` : ''}. Pay now to protect your account.`
            ),
            button: repay
         };
      case 'repaid':
         return {
            text: say(locale, `✅ Pembayaran ${owed} diterima. Terima kasih, pinjamanmu lunas!`, `✅ ${owed} received. Thank you, your loan is fully repaid!`),
            button: { text: say(locale, 'Pinjam lagi', 'Borrow again'), url: idAppUrl('/request-board') }
         };
      case 'request_expired':
         return {
            text: say(locale, '⌛ Permintaan pinjamanmu sudah kedaluwarsa tanpa pendanaan. Kamu bisa mengajukan lagi.', '⌛ Your loan request expired without funding. You can post a new one.'),
            button: { text: say(locale, 'Ajukan lagi', 'Request again'), url: idAppUrl('/request-board?applyLoan=1') }
         };
   }
};

export const idResendReason = (reason: string | null | undefined, locale: IdLocale, english?: string | null) =>
   locale === 'id' ? (reason ? (RESEND_ID[reason] ?? null) : null) : (english ?? null);

type IdRecipient = { id?: string; chat_id?: string | number | null; preferred_locale?: string | null; market?: string | null };

/** Send one event to a user row already in hand. Only for market 'ID'. Never throws; true when sent. */
export const sendIdTelegramTo = async (user: IdRecipient | null | undefined, event: IdEvent, data: IdEventData = {}): Promise<boolean> => {
   if (!user || user.market !== 'ID') return false;
   const tag = user.id ? user.id.slice(0, 8) : '?';
   if (!user.chat_id) {
      console.log(`[idTrack] ${event} for ${tag} → not sent (no Telegram chat)`);
      return false;
   }
   try {
      const msg = buildIdMessage(event, idLocaleOf(user.preferred_locale), data);
      const keyboard: TelegramInlineKeyboard | undefined = msg.button ? [[msg.button]] : undefined;
      await sendTelegramMessage(user.chat_id, msg.text, keyboard ? { inlineKeyboard: keyboard } : {});
      console.log(`[idTrack] ${event} for ${tag} → sent`);
      return true;
   } catch (err) {
      console.error(`[idTrack] ${event} for ${tag} → failed`, err instanceof Error ? err.message : err);
      return false;
   }
};

/** Load the person and send one event (Indonesia track only). Never throws; true when sent. */
export const sendIdTelegram = async (svc: Svc, userId: string, event: IdEvent, data: IdEventData = {}): Promise<boolean> => {
   try {
      const { data: user, error } = await svc.from('users').select('id, chat_id, preferred_locale, market').eq('id', userId).maybeSingle();
      if (error || !user) return false;
      return await sendIdTelegramTo(user as IdRecipient, event, data);
   } catch (err) {
      console.error(`[idTrack] ${event} for ${userId.slice(0, 8)} failed`, err instanceof Error ? err.message : err);
      return false;
   }
};

/**
 * "✅ <step> selesai — langkah berikutnya: <next>" with a button to /id/onboarding?step=<next>.
 * Sent only when the status RPC agrees the step really is done (e.g. Facebook needs the Messenger
 * code AND the profile link); otherwise it just points at what's next. Never throws.
 */
export const notifyIdNextStep = async (svc: Svc, userId: string, doneStep: IdStep): Promise<boolean> => {
   const status = await loadIdStatus(svc, userId);
   if (status?.market !== 'ID') return false;
   const done = Boolean(status.steps?.[doneStep]);
   return await sendIdTelegram(svc, userId, done ? 'step_done' : 'next_step', { doneStep, next: status.next ?? null });
};

/**
 * The team can't ✅ an Indonesian until Didit has approved their ID. Returns the message to show the
 * admin when blocked, or null (not on the track, or KYC approved). Fails open to null only when the
 * person isn't readable at all.
 */
export const ID_KYC_NOT_APPROVED = '⛔ KYC belum disetujui — this Indonesia-track borrower can only be approved once Didit has approved their ID (is_didit = ACTIVE).';
export const idApprovalBlock = async (svc: Svc, userId: string | null | undefined): Promise<string | null> => {
   if (!userId) return null;
   try {
      const { data, error } = await svc.from('users').select('market, is_didit').eq('id', userId).maybeSingle();
      if (error || !data) return null;
      const row = data as { market?: string | null; is_didit?: string | null };
      return row.market === 'ID' && row.is_didit !== 'ACTIVE' ? ID_KYC_NOT_APPROVED : null;
   } catch {
      return null;
   }
};

// ── WhatsApp: notifications + humans only, never a bot conversation ───────────────────────────────
export const ID_WHATSAPP_CONNECTED_TEXT = '✅ WhatsApp terhubung. Kembali ke aplikasi Moodeng.';
const TELEGRAM_BOT_USERNAME = (Deno.env.get('TELEGRAM_BOT_USERNAME') ?? 'moodengnewbranchbot').trim().replace(/^@/, '');
export const ID_WHATSAPP_USE_TELEGRAM_TEXT = `Untuk Moodeng, gunakan Telegram ya: https://t.me/${TELEGRAM_BOT_USERNAME}`;

/** Is the WhatsApp contact an Indonesia-track account? (Bot actions must not run a conversation for them.) */
export const isIdWhatsAppContact = async (svc: Svc, contactId: string): Promise<boolean> => {
   try {
      const { data, error } = await svc.from('users').select('market').eq('whatsapp_contact_id', contactId).limit(1).maybeSingle();
      if (error) return false;
      return (data as { market?: string | null } | null)?.market === 'ID';
   } catch {
      return false;
   }
};

// ── stalled onboarding nudges (runs inside video-call-reminders, about once an hour) ──────────────
const NUDGE_MAX = 3;
const NUDGE_GAP_MS = 24 * 60 * 60 * 1000;
const NUDGE_AFTER_SIGNUP_MS = 2 * 60 * 60 * 1000;
const NUDGE_BATCH = 50;

/**
 * Indonesians whose next step isn't 'waiting' / 'apply', signed up more than 2h ago, not nudged in the
 * last 24h, at most 3 nudges in all: "Tinggal X langkah lagi" with the next-step button. Each nudge is
 * claimed (conditional update on users.id_nudge_count) before it's sent, so overlapping runs can't
 * double-send. Returns how many were sent. Never throws.
 */
export const runIdOnboardingNudges = async (svc: Svc, now = Date.now()): Promise<number> => {
   try {
      const { data, error } = await svc
         .from('users')
         .select('id, chat_id, preferred_locale, market, id_nudge_count, id_nudged_at, created_at, account_status')
         .eq('market', 'ID')
         .not('chat_id', 'is', null)
         .lt('created_at', new Date(now - NUDGE_AFTER_SIGNUP_MS).toISOString())
         .lt('id_nudge_count', NUDGE_MAX)
         .or(`id_nudged_at.is.null,id_nudged_at.lt.${new Date(now - NUDGE_GAP_MS).toISOString()}`)
         .order('created_at', { ascending: false })
         .limit(NUDGE_BATCH);
      if (error) {
         console.error('[idTrack] nudge query failed', error.message);
         return 0;
      }
      let sent = 0;
      for (const user of (data ?? []) as Array<IdRecipient & { id: string; id_nudge_count: number | null; id_nudged_at: string | null; account_status: string | null }>) {
         if (user.account_status && user.account_status !== 'active') continue;
         const status = await loadIdStatus(svc, user.id);
         const next = status?.next;
         if (next === 'waiting' || next === 'apply') {
            // Past onboarding: take them out of the nudge queue for good.
            await svc.from('users').update({ id_nudge_count: NUDGE_MAX }).eq('id', user.id);
            continue;
         }
         if (status?.market !== 'ID' || !next || next === 'telegram') continue;
         const count = user.id_nudge_count ?? 0;
         const { data: claimed } = await svc
            .from('users')
            .update({ id_nudge_count: count + 1, id_nudged_at: new Date(now).toISOString() })
            .eq('id', user.id)
            .eq('id_nudge_count', count)
            .select('id')
            .maybeSingle();
         if (!claimed) continue;
         if (await sendIdTelegramTo(user, 'nudge', { next, stepsLeft: stepsLeft(status) })) sent += 1;
      }
      return sent;
   } catch (err) {
      console.error('[idTrack] nudges failed', err instanceof Error ? err.message : err);
      return 0;
   }
};
