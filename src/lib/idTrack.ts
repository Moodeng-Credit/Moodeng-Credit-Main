/**
 * Indonesia track (supabase/migrations/20261107120000_indonesia_track.sql).
 *
 * Indonesians who come in through /id get their own, stricter system: Telegram-only sign-up,
 * a long verified onboarding (Telegram → WhatsApp → Facebook → about you → proof of income →
 * ID + liveness → Walt address → call), $5/$10 loans with short terms, money in and out through
 * Walt (Telegram wallet) bridged Base ↔ BNB Chain, and the Telegram bot messages them about
 * everything. users.market = 'ID' marks them; loans.market = 'ID' marks their requests.
 *
 * The step order lives in SQL (id_onboarding_status) so the app, the bot and the server checks
 * (create-didit-session, loan-access, the loans insert trigger) all agree.
 */

export type IdStepKey = 'telegram' | 'whatsapp' | 'facebook' | 'about' | 'income' | 'kyc' | 'walt' | 'call';

export const ID_STEP_ORDER: readonly IdStepKey[] = ['telegram', 'whatsapp', 'facebook', 'about', 'income', 'kyc', 'walt', 'call'];

export type IdNext = IdStepKey | 'apply' | 'waiting';

export type IdTrackSwitch = 'off' | 'test' | 'on';

/** firstLoanMax: set while this borrower hasn't repaid a loan on time yet (amounts are capped to it). */
export type IdLoanRules = { amounts: number[]; maxTermDays: number; firstLoanMax?: number | null };

export type IdOnboarding = {
   /** 'ID' when this account is on the Indonesia track. */
   market: 'ID' | null;
   track: IdTrackSwitch;
   rules: IdLoanRules;
   steps: Record<IdStepKey, boolean>;
   /** Facebook step parts: Messenger code received / profile link + follow saved. */
   messenger: boolean;
   facebookProfile: boolean;
   /** Latest proof-of-income state: 'approved' | 'declined' | 'resend' | null (sent, not decided). */
   incomeState: string | null;
   kycApproved: boolean;
   kycState: string;
   /** users.loan_access_status: none | pending | approved | rejected */
   access: string;
   readyForKyc: boolean;
   readyForCall: boolean;
   next: IdNext;
};

export const DEFAULT_ID_RULES: IdLoanRules = { amounts: [5, 10], maxTermDays: 14 };

/** Term choices shown on the loan form, clipped to the server's max. */
export const idTermOptions = (rules: IdLoanRules): number[] => [7, 14].filter((d) => d <= rules.maxTermDays);

export const ID_PATHS = {
   /** Public landing for Indonesians (from Facebook / TikTok ads). Telegram-only sign-up. */
   landing: '/id',
   /** The step-by-step onboarding. ?step=<IdStepKey> opens one step. */
   onboarding: '/id/onboarding'
} as const;

export const MOODENG_FACEBOOK_PAGE_URL = 'https://www.facebook.com/MoodengCredit/';

/** Walt — Telegram's wallet bot (ex "Wallet"). P2P lets people buy/sell USDT for IDR. */
export const WALT_BOT_URL = 'https://t.me/wallet';

/** Chains and tokens used for the Walt bridge (Relay). BNB Chain USDC/USDT use 18 decimals. */
export const BSC_CHAIN_ID = 56;
export const BSC_USDC_ADDRESS = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
export const BSC_USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';

export const isEvmAddress = (v: string): boolean => /^0x[0-9a-fA-F]{40}$/.test(v.trim());

const asBool = (v: unknown): boolean => v === true;

/** Parses my_id_onboarding() — tolerant so an older backend (RPC missing) reads as "not on the track". */
export const parseIdOnboarding = (raw: unknown): IdOnboarding => {
   const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
   const steps = (r.steps && typeof r.steps === 'object' ? r.steps : {}) as Record<string, unknown>;
   const rules = (r.rules && typeof r.rules === 'object' ? r.rules : {}) as Record<string, unknown>;
   const amounts = Array.isArray(rules.amounts) ? rules.amounts.map(Number).filter((n) => Number.isFinite(n) && n > 0) : [];
   const maxTermDays = Number(rules.maxTermDays);
   const track = r.track === 'on' || r.track === 'test' ? r.track : 'off';
   const next = typeof r.next === 'string' ? (r.next as IdNext) : 'telegram';
   return {
      market: r.market === 'ID' ? 'ID' : null,
      track,
      rules: {
         amounts: amounts.length ? amounts : DEFAULT_ID_RULES.amounts,
         maxTermDays: Number.isFinite(maxTermDays) && maxTermDays > 0 ? maxTermDays : DEFAULT_ID_RULES.maxTermDays
      },
      steps: Object.fromEntries(ID_STEP_ORDER.map((k) => [k, asBool(steps[k])])) as Record<IdStepKey, boolean>,
      messenger: asBool(r.messenger),
      facebookProfile: asBool(r.facebookProfile),
      incomeState: typeof r.incomeState === 'string' ? r.incomeState : null,
      kycApproved: asBool(r.kycApproved),
      kycState: typeof r.kycState === 'string' ? r.kycState : '',
      access: typeof r.access === 'string' ? r.access : 'none',
      readyForKyc: asBool(r.readyForKyc),
      readyForCall: asBool(r.readyForCall),
      next
   };
};

/** Friendly messages for the RPC errors raised in the migration. */
export const ID_TRACK_ERRORS: Record<string, { id: string; en: string }> = {
   id_track_closed: { id: 'Pendaftaran Indonesia belum dibuka.', en: 'Indonesia sign-up isn’t open yet.' },
   id_track_existing_borrower: { id: 'Akun ini sudah pernah meminjam.', en: 'This account has borrowed before.' },
   facebook_profile_invalid: { id: 'Tempel link profil Facebook kamu.', en: 'Paste your Facebook profile link.' },
   facebook_follow_required: { id: 'Ikuti halaman Facebook kami dulu.', en: 'Follow our Facebook page first.' },
   walt_address_invalid: { id: 'Alamat tidak valid. Harus mulai 0x…', en: 'That address isn’t valid. It starts with 0x…' },
   walt_address_is_moodeng_wallet: { id: 'Itu alamat Moodeng kamu. Tempel alamat Walt.', en: 'That’s your Moodeng address. Paste your Walt one.' },
   walt_address_in_use: { id: 'Alamat ini dipakai akun lain.', en: 'Another account uses this address.' },
   walt_address_id_track_only: { id: 'Hanya untuk akun Indonesia.', en: 'Only for Indonesia accounts.' }
};

export const idTrackErrorText = (message: string | undefined, lang: 'id' | 'en'): string => {
   const key = Object.keys(ID_TRACK_ERRORS).find((k) => (message ?? '').includes(k));
   if (key) return ID_TRACK_ERRORS[key][lang];
   return lang === 'id' ? 'Ada masalah. Coba lagi.' : 'Something went wrong. Try again.';
};
