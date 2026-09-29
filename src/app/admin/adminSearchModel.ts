// Matching for the admin panel's global search bar — pure so it's unit-testable.
// Searches the admin pages (nav tabs), the loaded user directory and the loan-request board.

export interface SearchablePage {
   id: string;
   label: string;
   group: string;
}

export interface SearchableUser {
   id: string;
   username: string;
   email: string | null;
   wallet_address: string | null;
   user_role: string;
   account_status: string;
}

export interface SearchableRequest {
   id: string;
   tracking_id: string;
   loan_amount: number;
   reason: string;
   borrower: { username: string } | null;
   borrower_wallet: string | null;
}

export type AdminSearchResult =
   | { kind: 'page'; id: string; title: string; detail: string }
   | { kind: 'user'; id: string; title: string; detail: string }
   | { kind: 'request'; id: string; title: string; detail: string };

const LIMITS = { page: 5, user: 8, request: 5 };

const shortWallet = (wallet: string) => `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;

// Lower is better: exact match, then prefix, then substring anywhere. -1 = no match.
function score(query: string, fields: Array<string | null | undefined>): number {
   let best = -1;
   for (const raw of fields) {
      if (!raw) continue;
      const field = raw.toLowerCase();
      const rank = field === query ? 0 : field.startsWith(query) ? 1 : field.includes(query) ? 2 : -1;
      if (rank !== -1 && (best === -1 || rank < best)) best = rank;
   }
   return best;
}

function ranked<T>(items: T[], query: string, fields: (item: T) => Array<string | null | undefined>, limit: number): T[] {
   return items
      .map((item, index) => ({ item, index, rank: score(query, fields(item)) }))
      .filter((entry) => entry.rank !== -1)
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .slice(0, limit)
      .map((entry) => entry.item);
}

export function searchAdmin(
   rawQuery: string,
   sources: { pages: SearchablePage[]; users: SearchableUser[]; requests: SearchableRequest[] }
): AdminSearchResult[] {
   const query = rawQuery.trim().toLowerCase().replace(/^@/, '');
   if (!query) return [];

   const pages = ranked(sources.pages, query, (p) => [p.label, p.group, p.id], LIMITS.page).map<AdminSearchResult>((p) => ({
      kind: 'page',
      id: p.id,
      title: p.label,
      detail: p.group
   }));

   const users = ranked(sources.users, query, (u) => [u.username, u.email, u.wallet_address, u.id], LIMITS.user).map<AdminSearchResult>(
      (u) => ({
         kind: 'user',
         id: u.id,
         title: u.username,
         detail: [u.user_role === 'unset' ? 'no role' : u.user_role, u.email, u.wallet_address ? shortWallet(u.wallet_address) : null]
            .concat(u.account_status !== 'active' ? [u.account_status] : [])
            .filter(Boolean)
            .join(' · ')
      })
   );

   const requests = ranked(
      sources.requests,
      query,
      (r) => [r.borrower?.username, r.tracking_id, r.borrower_wallet, r.reason, r.id],
      LIMITS.request
   ).map<AdminSearchResult>((r) => ({
      kind: 'request',
      id: r.id,
      title: `${r.borrower?.username ?? 'Unknown borrower'} · $${Number(r.loan_amount ?? 0).toLocaleString()}`,
      detail: r.reason || r.tracking_id
   }));

   return [...pages, ...users, ...requests];
}
