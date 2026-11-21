// Repeat / mule / family accounts: other accounts tied to this one by a strong signal (same device,
// home internet, WhatsApp, Facebook, wallet, payout address, or the ID check's identity matches) —
// SQL public.linked_accounts (migration 20261120170000). "bad" = rejected, ghosted, blocked,
// blacklisted, or a loan 3+ days overdue.
//
//   preScreeningAsk.redFlags   a bad link is a red flag: no auto ✅ Good fit
//   linkedSweep (every 30 min, kyc-cross-check {"linked_sweep":true}, "dry":true previews)
//                              new accounts (last 3 days) linked to a bad one → ⚠️ once to the admin chat
//   autoRejectLinked           strong evidence it's the SAME PERSON as a bad account → rejected on its own
//                              (George 2026-11-21, after a 4th account from someone rejected 3 times).
//                              Runs in the sweep and when a pre-screening card is posted.
//
// Strong = a person-level link (same Facebook, same Facebook profile, same wallet, ID check: same person /
// same document), OR a household link (WhatsApp, home internet, device, payout address, address) AND the
// same first name and surname. A household link alone is often family (an approved borrower shares a
// WhatsApp with a rejected relative), and a shared surname alone is family too: those stay a ⚠️ / red flag
// for the team. Setting linked_auto_reject: reject (default) | observe (say what it would do) | off.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { blockRows } from './blockForGood.ts';
import { REJECT_LABEL } from './callStrikes.ts';
import { getAdminChatId, rejectUser } from './loanAccess.ts';
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
   return bad.length
      ? `linked to ${bad.length === 1 ? 'a bad account' : `${bad.length} bad accounts`}: ${bad.slice(0, 3).map(linkedLine).join('; ')}`
      : null;
};

// ---- Same person → automatic reject ------------------------------------------------------------

// The link itself says it's the same person.
const PERSON_VIA = new Set(['same Facebook', 'same Facebook profile', 'same wallet', 'ID check: same person', 'ID check: same document']);
// Name parts too common to tell two people apart (shared by siblings, cousins, half the country).
const COMMON_NAME_PARTS = new Set([
   'mae',
   'ann',
   'anne',
   'marie',
   'maria',
   'mary',
   'jane',
   'joy',
   'grace',
   'rose',
   'john',
   'jay',
   'dela',
   'del',
   'los'
]);

export type NameParts = { parts: Set<string>; firsts: Set<string> };

const splitName = (n: string | null | undefined) =>
   (n ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((p) => p.length >= 3 && !COMMON_NAME_PARTS.has(p));

/** Name parts for matching (lowercase letters only, 3+ letters, not too common) and each name's first part. Pure. */
export const nameParts = (...names: Array<string | null | undefined>): NameParts => {
   const parts = new Set<string>();
   const firsts = new Set<string>();
   for (const n of names) {
      const split = splitName(n);
      split.forEach((p) => parts.add(p));
      if (split[0]) firsts.add(split[0]);
   }
   return { parts, firsts };
};

/**
 * Same first name and surname, in any order: two shared name parts, one of them the first part of a
 * name. Siblings share a middle name (the mother's surname) and a surname, so that alone isn't enough. Pure.
 */
export const sameName = (a: NameParts, b: NameParts) => {
   const shared = [...a.parts].filter((p) => b.parts.has(p));
   return shared.length >= 2 && shared.some((p) => a.firsts.has(p) || b.firsts.has(p));
};

export type NamedLink = LinkedAccount & { names: NameParts; rejectReason?: string | null };

/**
 * The bad links that show it's the same person (see the top of the file). A bad account that is bad
 * only because THIS rule rejected it is not evidence (no chains of automatic rejects). Pure.
 */
export const samePersonLinks = (myNames: NameParts, links: NamedLink[]): NamedLink[] =>
   links.filter((a) => {
      if (!a.bad) return false;
      if (a.rejectReason === 'linked_account' && a.why === 'rejected') return false;
      if (a.via.some((v) => PERSON_VIA.has(v))) return true;
      return sameName(myNames, a.names);
   });

const loadRejectMode = async (svc: SupabaseClient): Promise<'reject' | 'observe' | 'off'> => {
   const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', 'linked_auto_reject').maybeSingle();
   const v = String((data as { value?: string } | null)?.value ?? 'reject')
      .trim()
      .toLowerCase();
   return v === 'off' || v === 'false' ? 'off' : v === 'observe' ? 'observe' : 'reject';
};

export type LinkedRejectResult = { user: string; evidence: string[]; done: 'rejected' | 'would_reject' | 'observed' };

/**
 * Rejects them (the normal reject: told their application is closed, cards stamped, call cancelled)
 * when they're the same person as a bad account. Skips test accounts, lenders, anyone approved or
 * already rejected, anyone with a funded loan, anyone the team let back in (/reopen), and anyone this
 * already rejected once. Returns what it did, or null. Never throws.
 */
export async function autoRejectLinked(
   svc: SupabaseClient,
   userId: string,
   opts: { dry?: boolean } = {}
): Promise<LinkedRejectResult | null> {
   try {
      const [{ data: me }, { count: funded }, { data: mark }] = await Promise.all([
         svc
            .from('users')
            .select('id, username, display_name, facebook_name, is_test, user_role, loan_access_status')
            .eq('id', userId)
            .maybeSingle(),
         svc.from('loans').select('id', { count: 'exact', head: true }).eq('borrower_user_id', userId).not('funded_at', 'is', null),
         svc.from('linked_account_alerts').select('auto_rejected_at, team_cleared_at').eq('user_id', userId).maybeSingle()
      ]);
      if (!me || me.is_test || me.user_role === 'lender' || funded) return null;
      if (me.loan_access_status === 'approved' || me.loan_access_status === 'rejected') return null;
      if (mark?.auto_rejected_at || mark?.team_cleared_at) return null;

      const bad = (await loadLinkedAccounts(svc, userId)).filter((a) => a.bad);
      if (!bad.length) return null;
      const { data: others } = await svc
         .from('users')
         .select('id, display_name, facebook_name, loan_access_reject_reason')
         .in(
            'id',
            bad.map((a) => a.user_id)
         );
      const byId = new Map(
         (
            (others ?? []) as Array<{
               id: string;
               display_name: string | null;
               facebook_name: string | null;
               loan_access_reject_reason: string | null;
            }>
         ).map((o) => [o.id, o])
      );
      const myNames = nameParts(me.facebook_name, me.display_name);
      const named: NamedLink[] = bad.map((a) => ({
         ...a,
         names: nameParts(byId.get(a.user_id)?.facebook_name, byId.get(a.user_id)?.display_name),
         rejectReason: byId.get(a.user_id)?.loan_access_reject_reason ?? null
      }));
      const strong = samePersonLinks(myNames, named);
      if (!strong.length) return null;

      const whoText = me.username ? `@${me.username}` : (me.display_name ?? userId.slice(0, 8));
      const evidence = strong.map((a) => `${linkedLine(a)}${a.via.some((v) => PERSON_VIA.has(v)) ? '' : ', same name'}`);
      if (opts.dry) return { user: whoText, evidence, done: 'would_reject' };

      const mode = await loadRejectMode(svc);
      if (mode === 'off') return null;
      const chat = await getAdminChatId(svc);
      if (mode === 'observe') {
         if (!mark) {
            await svc.from('linked_account_alerts').upsert({ user_id: userId, detail: strong.map(({ names: _n, ...a }) => a) });
            if (chat)
               await sendTelegramMessage(
                  chat,
                  [
                     `👀 Linked accounts (observe only, not rejected) — ${whoText} looks like the same person as:`,
                     ...evidence.map((e) => `• ${e}`)
                  ].join('\n')
               ).catch(() => undefined);
         }
         return { user: whoText, evidence, done: 'observed' };
      }

      const result = await rejectUser(svc, userId, REJECT_LABEL.linked_account, { strikeReason: 'linked_account' });
      if (!result.ok) {
         console.log('linked accounts: auto reject skipped for', userId, result.summary);
         return null;
      }
      await svc
         .from('linked_account_alerts')
         .upsert({ user_id: userId, auto_rejected_at: new Date().toISOString(), detail: strong.map(({ names: _n, ...a }) => a) });
      const text = [
         `🤖 Auto-rejected ${whoText} — same person as ${strong.length === 1 ? 'an account' : `${strong.length} accounts`} we already turned down:`,
         ...evidence.slice(0, 6).map((e) => `• ${e}`),
         'They were told their application is closed (not why).',
         `Wrong? /reopen @${me.username ?? userId}`
      ].join('\n');
      if (chat) await sendTelegramMessage(chat, text).catch((err) => console.error('linked accounts: telegram failed', err));
      return { user: whoText, evidence, done: 'rejected' };
   } catch (err) {
      console.error('linked accounts: auto reject failed', userId, err instanceof Error ? err.message : err);
      return null;
   }
}

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
   const { data: done } = await svc
      .from('linked_account_alerts')
      .select('user_id')
      .in(
         'user_id',
         (fresh ?? []).map((u) => u.id)
      );
   const already = new Set(((done ?? []) as Array<{ user_id: string }>).map((r) => r.user_id));
   const chat = opts.dry ? null : await getAdminChatId(svc);
   const found: Array<{ user: string; links: string[] }> = [];
   const rejected: LinkedRejectResult[] = [];
   for (const u of (fresh ?? []) as Array<{ id: string; username: string | null; display_name: string | null }>) {
      // Same person as a bad account → rejected. Checked every time (a WhatsApp or Facebook added after
      // the ⚠️ can make the evidence strong later); autoRejectLinked itself never acts twice.
      const auto = await autoRejectLinked(svc, u.id, opts);
      if (auto) {
         rejected.push(auto);
         if (auto.done !== 'observed') continue;
      }
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
         `🚫 Block for good = quiet reject, plus later accounts on the same WhatsApp. Or /ghost @${u.username ?? u.id} · Admin: https://moodeng.app/admin?user=${u.id}`
      ].join('\n');
      if (chat) await sendTelegramMessage(chat, text, { inlineKeyboard: blockRows(u.id) }).catch((err) => console.error('linked sweep: telegram failed', err));
      await svc.from('linked_account_alerts').upsert({ user_id: u.id, detail: bad });
   }
   return { ok: true, checked: (fresh ?? []).length, rejected, flagged: found };
}
