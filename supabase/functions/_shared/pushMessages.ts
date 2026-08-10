// Notification copy for the push channel, in the three locales the app ships
// (en / fil / id). Pure functions — no Supabase, no crypto — so the wording can
// be unit-tested and reviewed without standing anything up.
//
// Push copy is not email copy. A lock-screen notification gets roughly two lines
// before Android and iOS truncate it, and the user decides in under a second
// whether to open it. So: the number goes in the title, the reason to act goes
// in the body, and nothing is repeated between the two. Titles are held to ~40
// characters and bodies to ~120, measured on the longest locale.
//
// The one piece of judgement worth stating outright: the repeat-borrower push
// leads with "they already repaid you", because that — not the request itself —
// is the fact that makes a lender open the app. Never states or implies the
// borrower's gender; the app collects no such field and a name is not evidence.

export type PushNotificationType =
   | 'repeat_borrower_request'
   | 'final_reminder'
   | 'urgent_reminder'
   | 'overdue'
   | 'funded'
   | 'repayment_received'
   | 'request_expired';

export type PushLocale = 'en' | 'fil' | 'id';

export const PUSH_LOCALES: PushLocale[] = ['en', 'fil', 'id'];

export const resolvePushLocale = (value: string | null | undefined): PushLocale => {
   const normalized = (value ?? '').trim().toLowerCase().split(/[-_]/)[0];
   return (PUSH_LOCALES as string[]).includes(normalized) ? (normalized as PushLocale) : 'en';
};

/** Everything the service worker needs to render and route one notification. */
export type PushPayload = {
   type: PushNotificationType;
   title: string;
   body: string;
   /** Absolute app URL opened on tap. */
   url: string;
   /**
    * Collapse key. A second notification with the same tag replaces the first
    * rather than stacking, so a borrower with a hourly-cron retry sees one
    * "due tomorrow" notification, not six.
    */
   tag: string;
   /** Set for reminders so a missed notification stays on the lock screen. */
   requireInteraction?: boolean;
};

export type RepeatBorrowerPushContext = {
   loanId: string;
   borrowerUsername: string | null;
   /** Amount being requested now, in USDC. */
   requestAmount: number;
   /** How many loans this borrower has already repaid this lender in full. */
   repaidLoanCount: number;
   /** Total the borrower has repaid this lender across those loans, in USDC. */
   repaidTotal: number;
   reason: string | null;
};

export type DuePushContext = {
   /** Number of loans rolled into this reminder. */
   loanCount: number;
   /** Combined outstanding amount across those loans, in USDC. */
   totalAmount: number;
   /**
    * The caller's English window phrase — "24 hours", "3 days". Localised here
    * rather than trusted verbatim: the cron renders it once in English for the
    * email subject, and dropping that straight into a Tagalog or Indonesian body
    * produced "sa loob ng 24 hours".
    */
   dueLabel: string;
};

const SITE_URL_FALLBACK = 'https://dashboard.moodeng.app';

const getSiteUrl = () => {
   const configured = Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('MOODENG_APP_URL') ?? Deno.env.get('SITE_URL');
   const url = configured && /^https?:\/\//.test(configured) ? configured : SITE_URL_FALLBACK;
   return url.replace(/\/$/, '');
};

const buildAppUrl = (path: string) => `${getSiteUrl()}${path.startsWith('/') ? path : `/${path}`}`;

const formatUsdc = (amount: number | string | null | undefined) => {
   const value = Number(amount ?? 0);
   return `$${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
};

// Reasons are borrower free text and can run long; a push body that overflows is
// worse than one that stops early, so quote it only when it fits comfortably.
const truncate = (value: string, max: number) => (value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`);

const quotedReason = (reason: string | null | undefined, max = 34): string | null => {
   const cleaned = (reason ?? '').replace(/\s+/g, ' ').trim();
   return cleaned ? `“${truncate(cleaned, max)}”` : null;
};

const DUE_UNITS: Record<PushLocale, { hour: string; day: string }> = {
   en: { hour: 'hours', day: 'days' },
   fil: { hour: 'oras', day: 'araw' },
   id: { hour: 'jam', day: 'hari' }
};

const DUE_UNITS_SINGULAR: Record<PushLocale, { hour: string; day: string }> = {
   en: { hour: 'hour', day: 'day' },
   // Filipino and Indonesian don't inflect these for number.
   fil: { hour: 'oras', day: 'araw' },
   id: { hour: 'jam', day: 'hari' }
};

/**
 * Rewrites the caller's English "24 hours" / "3 days" into the target locale.
 * Anything that doesn't match that shape is passed through untouched, so an
 * unexpected label degrades to English rather than to an empty string.
 */
const localiseDueLabel = (label: string, locale: PushLocale): string => {
   const match = /^(\d+)\s+(hours?|days?)$/i.exec(label.trim());
   if (!match) {
      return label;
   }

   const count = Number(match[1]);
   const unitKey = match[2].toLowerCase().startsWith('day') ? 'day' : 'hour';
   const units = count === 1 ? DUE_UNITS_SINGULAR[locale] : DUE_UNITS[locale];

   return `${count} ${units[unitKey]}`;
};

const displayName = (username: string | null | undefined, fallback: Record<PushLocale, string>, locale: PushLocale) =>
   (username ?? '').trim() || fallback[locale];

const ANON_BORROWER: Record<PushLocale, string> = {
   en: 'A past borrower',
   fil: 'Isang dating borrower',
   id: 'Peminjam sebelumnya'
};

/**
 * "Someone you already got paid back by is asking again."
 *
 * The lead fact is the repayment history, because that is the lender's own
 * evidence about this borrower — it outperforms anything we could say about the
 * new request. Phrased in the third person plural throughout: the app stores no
 * gender and a username is not a basis for guessing one.
 */
const buildRepeatBorrowerPush = (context: RepeatBorrowerPushContext, locale: PushLocale): PushPayload => {
   const name = displayName(context.borrowerUsername, ANON_BORROWER, locale);
   const asking = formatUsdc(context.requestAmount);
   const repaid = formatUsdc(context.repaidTotal);
   const reason = quotedReason(context.reason);
   const isRepeat = context.repaidLoanCount > 1;

   const copy: Record<PushLocale, { title: string; body: string }> = {
      en: {
         title: `${name} is asking again`,
         body: isRepeat
            ? `They've repaid you ${context.repaidLoanCount} times, ${repaid} in full. Now asking ${asking} USDC${reason ? ` — ${reason}` : ''}.`
            : `They repaid you ${repaid} in full. Now asking ${asking} USDC${reason ? ` — ${reason}` : ''}.`
      },
      fil: {
         title: `Humihiram ulit si ${name}`,
         body: isRepeat
            ? `${context.repaidLoanCount} beses ka nang nabayaran nang buo, ${repaid} lahat. Ngayon ${asking} USDC${reason ? ` — ${reason}` : ''}.`
            : `Nabayaran ka nang buo, ${repaid}. Ngayon ${asking} USDC${reason ? ` — ${reason}` : ''}.`
      },
      id: {
         title: `${name} mengajukan lagi`,
         body: isRepeat
            ? `Sudah ${context.repaidLoanCount} kali melunasi ke kamu, total ${repaid}. Kini minta ${asking} USDC${reason ? ` — ${reason}` : ''}.`
            : `Sudah melunasi ${repaid} ke kamu. Kini minta ${asking} USDC${reason ? ` — ${reason}` : ''}.`
      }
   };

   return {
      type: 'repeat_borrower_request',
      title: copy[locale].title,
      body: copy[locale].body,
      url: buildAppUrl(`/lend/loan/${context.loanId}`),
      // One notification per request per lender; a re-fire replaces it.
      tag: `repeat-borrower:${context.loanId}`
   };
};

/**
 * "You owe money and the clock is short." Fired by the hourly due-date cron for
 * the ≤24h window (final_reminder) and the ≤72h window (urgent_reminder).
 *
 * The amount leads because that is what the borrower needs to go find. The body
 * carries the deadline and the consequence — credit level is the lever borrowers
 * on this product actually respond to.
 */
const buildDuePush = (
   type: 'final_reminder' | 'urgent_reminder' | 'overdue',
   context: DuePushContext,
   locale: PushLocale
): PushPayload => {
   const amount = formatUsdc(context.totalAmount);
   const isMulti = context.loanCount > 1;
   const dueLabel = localiseDueLabel(context.dueLabel, locale);

   const copy: Record<PushLocale, Record<typeof type, { title: string; body: string }>> = {
      en: {
         final_reminder: {
            title: `${amount} USDC due tomorrow`,
            body: isMulti
               ? `${context.loanCount} repayments are due within ${dueLabel}. Pay on time to keep your credit level.`
               : `Your repayment is due within ${dueLabel}. Pay on time to keep your credit level.`
         },
         urgent_reminder: {
            title: `${amount} USDC due soon`,
            body: isMulti
               ? `${context.loanCount} repayments are due in ${dueLabel}. Tap to repay early and stay on track.`
               : `Due in ${dueLabel}. Tap to repay early and stay on track.`
         },
         overdue: {
            title: `${amount} USDC is overdue`,
            body: isMulti
               ? `${context.loanCount} repayments have passed their due date. Repay now to protect your credit level.`
               : `Your repayment has passed its due date. Repay now to protect your credit level.`
         }
      },
      fil: {
         final_reminder: {
            title: `${amount} USDC, due bukas`,
            body: isMulti
               ? `May ${context.loanCount} bayarin sa loob ng ${dueLabel}. Magbayad on time para hindi bumaba ang credit level mo.`
               : `Due na sa loob ng ${dueLabel}. Magbayad on time para hindi bumaba ang credit level mo.`
         },
         urgent_reminder: {
            title: `${amount} USDC, malapit nang due`,
            body: isMulti
               ? `May ${context.loanCount} bayarin sa loob ng ${dueLabel}. Mag-tap para magbayad nang maaga.`
               : `Due sa loob ng ${dueLabel}. Mag-tap para magbayad nang maaga.`
         },
         overdue: {
            title: `Overdue na ang ${amount} USDC`,
            body: isMulti
               ? `Lampas na sa due date ang ${context.loanCount} bayarin mo. Magbayad na para maprotektahan ang credit level mo.`
               : `Lampas na sa due date ang bayarin mo. Magbayad na para maprotektahan ang credit level mo.`
         }
      },
      id: {
         final_reminder: {
            title: `${amount} USDC jatuh tempo besok`,
            body: isMulti
               ? `${context.loanCount} pembayaran jatuh tempo dalam ${dueLabel}. Bayar tepat waktu agar credit level tetap aman.`
               : `Jatuh tempo dalam ${dueLabel}. Bayar tepat waktu agar credit level tetap aman.`
         },
         urgent_reminder: {
            title: `${amount} USDC segera jatuh tempo`,
            body: isMulti
               ? `${context.loanCount} pembayaran jatuh tempo dalam ${dueLabel}. Ketuk untuk bayar lebih awal.`
               : `Jatuh tempo dalam ${dueLabel}. Ketuk untuk bayar lebih awal.`
         },
         overdue: {
            title: `${amount} USDC lewat jatuh tempo`,
            body: isMulti
               ? `${context.loanCount} pembayaran sudah lewat jatuh tempo. Bayar sekarang untuk menjaga credit level.`
               : `Pembayaran kamu sudah lewat jatuh tempo. Bayar sekarang untuk menjaga credit level.`
         }
      }
   };

   return {
      type,
      title: copy[locale][type].title,
      body: copy[locale][type].body,
      url: buildAppUrl('/repay'),
      // Collapsed per type, so the hourly cron can retry without stacking.
      tag: `repayment:${type}`,
      // Money owed shouldn't quietly scroll off the lock screen.
      requireInteraction: type !== 'urgent_reminder'
   };
};

const buildFundedPush = (context: { amount: number }, locale: PushLocale): PushPayload => {
   const amount = formatUsdc(context.amount);
   const copy: Record<PushLocale, { title: string; body: string }> = {
      en: { title: `${amount} USDC is on the way`, body: 'Your loan request was funded. Tap to see the repayment date.' },
      fil: { title: `Padating na ang ${amount} USDC`, body: 'Na-fund na ang request mo. Mag-tap para makita ang due date.' },
      id: { title: `${amount} USDC sedang dikirim`, body: 'Pengajuanmu sudah didanai. Ketuk untuk melihat tanggal jatuh tempo.' }
   };

   return {
      type: 'funded',
      title: copy[locale].title,
      body: copy[locale].body,
      url: buildAppUrl('/dashboard'),
      tag: 'loan-funded'
   };
};

const buildRepaymentReceivedPush = (context: { amount: number }, locale: PushLocale): PushPayload => {
   const amount = formatUsdc(context.amount);
   const copy: Record<PushLocale, { title: string; body: string }> = {
      en: { title: `${amount} USDC repaid to you`, body: 'A borrower you funded has paid you back. Tap to see the details.' },
      fil: { title: `Nabayaran ka ng ${amount} USDC`, body: 'Nagbayad na ang borrower na pinondohan mo. Mag-tap para sa detalye.' },
      id: { title: `${amount} USDC dilunasi ke kamu`, body: 'Peminjam yang kamu danai sudah membayar. Ketuk untuk detailnya.' }
   };

   return {
      type: 'repayment_received',
      title: copy[locale].title,
      body: copy[locale].body,
      url: buildAppUrl('/dashboard'),
      tag: 'repayment-received'
   };
};

const buildRequestExpiredPush = (locale: PushLocale): PushPayload => {
   const copy: Record<PushLocale, { title: string; body: string }> = {
      en: { title: 'Your loan request expired', body: 'No lender funded it in time. Tap to post it again or talk to support.' },
      fil: { title: 'Nag-expire ang request mo', body: 'Walang nag-fund sa oras. Mag-tap para mag-post ulit o kausapin ang support.' },
      id: { title: 'Pengajuanmu kedaluwarsa', body: 'Belum ada yang mendanai. Ketuk untuk mengajukan lagi atau hubungi support.' }
   };

   return {
      type: 'request_expired',
      title: copy[locale].title,
      body: copy[locale].body,
      url: buildAppUrl('/dashboard'),
      tag: 'request-expired'
   };
};

export const buildRepeatBorrowerPushPayload = buildRepeatBorrowerPush;
export const buildDuePushPayload = buildDuePush;
export const buildFundedPushPayload = buildFundedPush;
export const buildRepaymentReceivedPushPayload = buildRepaymentReceivedPush;
export const buildRequestExpiredPushPayload = buildRequestExpiredPush;
