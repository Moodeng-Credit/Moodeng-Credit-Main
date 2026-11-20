// Repeat / mule / family accounts: other accounts tied to this one by a strong signal (same device,
// home internet, WhatsApp, Facebook, wallet, payout address, or the ID check's identity matches) —
// SQL public.linked_accounts (migration 20261120170000). "bad" = rejected, ghosted, blocked,
// blacklisted, or a loan 3+ days overdue.
//
//   preScreeningAsk.redFlags   a bad link is a red flag: no auto ✅ Good fit
//   linkedSweep (every 30 min, kyc-cross-check {"linked_sweep":true}, "dry":true previews)
//                              new accounts (last 3 days) linked to a bad one → ⚠️ once to the admin chat
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { getAdminChatId } from './loanAccess.ts';
import { sendTelegramMessage } from './telegram.ts';

export type LinkedAccount = { user_id: string; username: string | null; status: string | null; via: string[]; bad: boolean; why: string };

export const loadLinkedAccounts = async (svc: SupabaseClient, userId: string): Promise<LinkedAccount[]> => {
   const { data, error } = await svc.rpc('linked_accounts', { p_user: userId });
   if (error) throw new Error(error.message);
   return (Array.isArray(data) ? data : []) as LinkedAccount[];
};

/** "@x (rejected) — same phone/device, same WhatsApp number". Pure. */
export const linkedLine = (a: LinkedAccount) =>
   `${a.username ? `@${a.username}` : a.user_id.slice(0, 8)}${a.why ? ` (${a.why})` : ''} — ${a.via.join(', ')}`;

/** Red flag text for pre-screening, or null. Pure. */
export const linkedRedFlag = (links: LinkedAccount[]): string | null => {
   const bad = links.filter((a) => a.bad);
   return bad.length ? `linked to ${bad.length === 1 ? 'a bad account' : `${bad.length} bad accounts`}: ${bad.slice(0, 3).map(linkedLine).join('; ')}` : null;
};

const NEW_ACCOUNT_DAYS = 3;

export async function linkedSweep(svc: SupabaseClient, opts: { dry?: boolean } = {}) {
   const since = new Date(Date.now() - NEW_ACCOUNT_DAYS * 86_400_000).toISOString();
   const { data: fresh, error } = await svc
      .from('users')
      .select('id, username, display_name, loan_access_status')
      .gte('created_at', since)
      .or('is_test.is.null,is_test.eq.false')
      .or('loan_access_status.is.null,loan_access_status.neq.rejected')
      .limit(300);
   if (error) return { ok: false, error: error.message };
   const { data: done } = await svc.from('linked_account_alerts').select('user_id').in('user_id', (fresh ?? []).map((u) => u.id));
   const already = new Set(((done ?? []) as Array<{ user_id: string }>).map((r) => r.user_id));
   const chat = opts.dry ? null : await getAdminChatId(svc);
   const found: Array<{ user: string; links: string[] }> = [];
   for (const u of (fresh ?? []) as Array<{ id: string; username: string | null; display_name: string | null }>) {
      if (already.has(u.id)) continue;
      let links: LinkedAccount[] = [];
      try {
         links = await loadLinkedAccounts(svc, u.id);
      } catch (err) {
         console.error('linked sweep: lookup failed', u.id, err instanceof Error ? err.message : err);
         continue;
      }
      const bad = links.filter((a) => a.bad);
      if (!bad.length) continue;
      const who = u.username ? `@${u.username}` : (u.display_name ?? u.id.slice(0, 8));
      found.push({ user: who, links: bad.map(linkedLine) });
      if (opts.dry) continue;
      const text = [
         `⚠️ New account ${who} is linked to ${bad.length === 1 ? 'a bad account' : `${bad.length} bad accounts`} — maybe the same person coming back, a mule or family:`,
         ...bad.slice(0, 6).map((a) => `• ${linkedLine(a)}`),
         '',
         `Quietly reject: /ghost @${u.username ?? u.id} · Admin: https://moodeng.app/admin?user=${u.id}`
      ].join('\n');
      if (chat) await sendTelegramMessage(chat, text).catch((err) => console.error('linked sweep: telegram failed', err));
      await svc.from('linked_account_alerts').upsert({ user_id: u.id, detail: bad });
   }
   return { ok: true, checked: (fresh ?? []).length - already.size, flagged: found };
}
