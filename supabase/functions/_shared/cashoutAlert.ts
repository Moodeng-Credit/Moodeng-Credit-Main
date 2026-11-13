// Team alert for every borrower cash-out: who, how much, where to, and when (Bangkok time).
// Posted by record-withdrawal right after a verified transfer is recorded, so each on-chain
// cash-out (Maya, bank QR, PDAX, GCrypto, Binance, Walt, Base Pay…) lands in the group once.

// The "Cash-outs" group (registered with /chatid on 2026-11-14). Override with the
// telegram_bot_settings key `cashout_alert_chat_id`.
export const DEFAULT_CASHOUT_ALERT_CHAT_ID = '-5512581390';

export type CashoutAlertInput = {
   amount: number;
   exchange: string;
   destination: string;
   txHash: string;
   wallet: 'embedded' | 'base';
   at: Date;
   user: {
      id: string;
      username?: string | null;
      displayName?: string | null;
      telegramUsername?: string | null;
      email?: string | null;
      market?: string | null;
   };
   // How many cash-outs this person has made, including this one.
   cashoutNumber: number;
};

const shortAddress = (address: string) => (address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address);

const ordinal = (n: number) => {
   const mod100 = n % 100;
   if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
   return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

export const formatBangkok = (at: Date) =>
   `${at.toLocaleString('en-US', {
      timeZone: 'Asia/Bangkok',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
   })} Bangkok`;

export const describeWho = (user: CashoutAlertInput['user']) => {
   const name = user.displayName?.trim() || user.username?.trim() || null;
   const handle = user.telegramUsername?.trim() ? `@${user.telegramUsername.trim().replace(/^@/, '')}` : null;
   const parts = [name, handle, !name && !handle ? user.email?.trim() || null : null].filter(Boolean);
   const who = parts.length ? parts.join(' · ') : 'Unknown user';
   return user.market ? `${who} (${user.market})` : who;
};

export const buildCashoutAlert = (input: CashoutAlertInput) => {
   const amount = input.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
   const nth = input.cashoutNumber > 0 ? ` · ${ordinal(input.cashoutNumber)} cash-out` : '';
   return [
      `💸 Cash-out: $${amount} USDC`,
      '',
      `Who: ${describeWho(input.user)}${nth}`,
      `How: ${input.exchange} · from ${input.wallet === 'base' ? 'Base Pay wallet' : 'Moodeng wallet'}`,
      `To: ${shortAddress(input.destination)}`,
      `When: ${formatBangkok(input.at)}`,
      `User ID: ${input.user.id}`
   ].join('\n');
};

export const cashoutTxUrl = (txHash: string) => `https://basescan.org/tx/${txHash}`;
