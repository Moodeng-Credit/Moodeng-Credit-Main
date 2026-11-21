// Facebook profile check, run once when a borrower first connects Messenger (sendpulse-messenger-verify).
// George, 2026-11-14: too many sign-ups, so these are auto-rejected before the call:
//    no_photo        their Facebook picture is the grey default silhouette
//    no_last_name    no real last name (empty, one letter, dots, or the first name again)
//    lowercase_name  the name isn't capitalised ("claire" instead of "Claire")
//
// The grey default picture is the same image for everyone, so it's spotted by its bytes: we keep a
// SHA-256 of each person's picture (facebook_photo_hashes), and a picture another account also has is
// the default (or a copied one — just as suspect). KNOWN_DEFAULT_PHOTO_HASHES seeds it. No picture we
// can read never counts as no_photo: this only rejects on what it actually saw.
//
// Switch: telegram_bot_settings.fb_profile_reject = 'off' (nothing happens), 'observe' (card only, no
// reject), anything else / missing = reject. The Telegram card keeps ✅ Approve after all.

import { sendAdminCard, stampDecisionCards } from './adminCards.ts';
import { postDiscord } from './discord.ts';
import { cancelUpcomingCall } from './callCancel.ts';
import { BORROWER_COLUMNS, type BorrowerRow, notifyBorrower, rejectFollowUpButtons, who } from './loanAccess.ts';
import type { SendPulseContact } from './sendpulse.ts';
import { testAccountRow } from './testAccount.ts';

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export type ProfileFlag = 'no_photo' | 'no_last_name' | 'lowercase_name';
export type FbRejectMode = 'off' | 'observe' | 'reject';

export const FLAG_TEXT: Record<ProfileFlag, string> = {
   no_photo: 'no Facebook photo (grey default picture)',
   no_last_name: 'no last name',
   lowercase_name: 'name not capitalised'
};

// Seed list of default-picture hashes; the shared-hash rule finds new ones on its own.
export const KNOWN_DEFAULT_PHOTO_HASHES = new Set<string>([]);

// Small Filipino/Indonesian surname particles that are written in lowercase ("dela Cruz", "de los Santos").
const PARTICLES = new Set(['de', 'del', 'dela', 'delos', 'los', 'la', 'las', 'van', 'von', 'di', 'da', 'bin', 'binti', 'y']);

const letters = (s: string) => s.replace(/[^\p{L}]/gu, '');
const startsLower = (word: string) => {
   const first = letters(word).charAt(0);
   return Boolean(first) && first !== first.toUpperCase() && first === first.toLowerCase();
};

/** Splits SendPulse's channel_data into first / last name (name alone → first word / the rest). */
export const splitFacebookName = (data: { name?: string | null; first_name?: string | null; last_name?: string | null } | null | undefined) => {
   const first = String(data?.first_name ?? '').trim();
   const last = String(data?.last_name ?? '').trim();
   if (first || last) return { first, last };
   const words = String(data?.name ?? '').trim().split(/\s+/).filter(Boolean);
   return { first: words[0] ?? '', last: words.slice(1).join(' ') };
};

/** The name rules. Empty input (no name from SendPulse at all) flags nothing. */
export const nameFlags = (first: string, last: string): ProfileFlag[] => {
   if (!first && !last) return [];
   const flags: ProfileFlag[] = [];
   const lastLetters = letters(last);
   if (lastLetters.length < 2 || lastLetters.toLowerCase() === letters(first).toLowerCase()) flags.push('no_last_name');
   // The first word of the first name and the last word of the last name must start with a capital;
   // lowercase particles in between are fine. A name in a script with no capitals passes.
   const firstWord = first.split(/\s+/).find((w) => letters(w)) ?? '';
   const lastWords = last.split(/\s+/).filter((w) => letters(w));
   const lastWord = [...lastWords].reverse().find((w) => !PARTICLES.has(letters(w).toLowerCase())) ?? '';
   if (startsLower(firstWord) || startsLower(lastWord)) flags.push('lowercase_name');
   return flags;
};

/** Their profile picture URL, wherever SendPulse puts it (field name differs between API versions). */
export const contactPhotoUrl = (contact: SendPulseContact | null): string | null => {
   // deno-lint-ignore no-explicit-any
   const c = contact as any;
   const candidates = [
      c?.channel_data?.profile_pic,
      c?.channel_data?.photo,
      c?.channel_data?.avatar,
      c?.channel_data?.picture,
      c?.photo,
      c?.avatar,
      c?.profile_pic
   ];
   const url = candidates.find((v) => typeof v === 'string' && /^https?:\/\//.test(v));
   return url ?? null;
};

// SendPulse's Messenger contact has no picture (checked 2026-11-14: channel_data has id, name,
// first/middle/last_name, email, phone, gender, link, location, hometown, locale). channel_data.id is
// the page-scoped Facebook id, so the picture comes from the Graph API with the Page token.
export const graphPhotoUrl = async (contact: SendPulseContact | null): Promise<{ url: string | null; error?: string }> => {
   // deno-lint-ignore no-explicit-any
   const psid = String((contact as any)?.channel_data?.id ?? '').trim();
   const token = Deno.env.get('FACEBOOK_PAGE_TOKEN')?.trim();
   if (!psid || !token) return { url: null, error: !psid ? 'no_psid' : 'no_token' };
   try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(psid)}?fields=profile_pic&access_token=${encodeURIComponent(token)}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) return { url: null, error: String(body?.error?.message ?? res.status).slice(0, 160) };
      return { url: typeof body?.profile_pic === 'string' ? body.profile_pic : null, error: body?.profile_pic ? undefined : 'no_profile_pic' };
   } catch (err) {
      return { url: null, error: err instanceof Error ? err.message : String(err) };
   }
};

const toHex =(buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** SHA-256 of the picture's bytes, or null if it can't be downloaded. */
export const photoHash = async (url: string): Promise<{ hash: string; bytes: number } | null> => {
   try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
         const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
         if (!res.ok) return null;
         const buf = await res.arrayBuffer();
         if (!buf.byteLength) return null;
         return { hash: toHex(await crypto.subtle.digest('SHA-256', buf)), bytes: buf.byteLength };
      } finally {
         clearTimeout(timer);
      }
   } catch (err) {
      console.error('facebookProfileCheck: photo download failed', err instanceof Error ? err.message : err);
      return null;
   }
};

export type ProfileCheck = {
   flags: ProfileFlag[];
   first: string;
   last: string;
   photoUrl: string | null;
   photoError: string | null;
   photoHash: string | null;
   photoBytes: number | null;
   sharedWith: number;
};

/** Runs every check and saves their picture hash. Never throws. */
export const checkFacebookProfile = async (svc: SupabaseClient, userId: string, contact: SendPulseContact | null): Promise<ProfileCheck> => {
   const { first, last } = splitFacebookName(contact?.channel_data);
   const flags = nameFlags(first, last);
   let photoUrl = contactPhotoUrl(contact);
   let photoError: string | null = null;
   if (!photoUrl) {
      const graph = await graphPhotoUrl(contact);
      photoUrl = graph.url;
      photoError = graph.error ?? null;
   }
   let hash: string | null = null;
   let bytes: number | null = null;
   let sharedWith = 0;
   if (photoUrl) {
      const got = await photoHash(photoUrl);
      if (got) {
         hash = got.hash;
         bytes = got.bytes;
         try {
            const { count } = await svc
               .from('facebook_photo_hashes')
               .select('user_id', { count: 'exact', head: true })
               .eq('hash', hash)
               .neq('user_id', userId);
            sharedWith = count ?? 0;
            await svc
               .from('facebook_photo_hashes')
               .upsert({ user_id: userId, hash, bytes, checked_at: new Date().toISOString() }, { onConflict: 'user_id' });
         } catch (err) {
            console.error('facebookProfileCheck: hash lookup failed', err instanceof Error ? err.message : err);
         }
         if (KNOWN_DEFAULT_PHOTO_HASHES.has(hash) || sharedWith > 0) flags.unshift('no_photo');
      }
   }
   return { flags, first, last, photoUrl, photoError, photoHash: hash, photoBytes: bytes, sharedWith };
};

export const loadRejectMode = async (svc: SupabaseClient): Promise<FbRejectMode> => {
   try {
      const { data } = await svc.from('telegram_bot_settings').select('value').eq('key', 'fb_profile_reject').maybeSingle();
      const v = String(data?.value ?? '').trim().toLowerCase();
      return v === 'off' || v === 'false' ? 'off' : v === 'observe' ? 'observe' : 'reject';
   } catch {
      return 'reject';
   }
};

/**
 * Auto-reject for a failed profile check. Skips test accounts, lenders, people already approved or
 * rejected, and anyone who has had a loan funded. Returns true when they were rejected (the caller
 * then skips the usual next-step messages).
 */
export const autoRejectForFacebookProfile = async (
   svc: SupabaseClient,
   userId: string,
   check: ProfileCheck,
   facebookName: string | null
): Promise<boolean> => {
   try {
      if (!check.flags.length) return false;
      const mode = await loadRejectMode(svc);
      if (mode === 'off') return false;

      const [{ data: user }, { count: funded }, { data: chatRow }] = await Promise.all([
         svc.from('users').select(`${BORROWER_COLUMNS}, user_role`).eq('id', userId).maybeSingle(),
         svc.from('loans').select('id', { count: 'exact', head: true }).eq('borrower_user_id', userId).not('funded_at', 'is', null),
         svc.from('telegram_bot_settings').select('value').eq('key', 'kyc_alert_chat_id').maybeSingle()
      ]);
      if (!user || user.is_test || user.user_role === 'lender' || funded) return false;
      if (user.loan_access_status === 'approved' || user.loan_access_status === 'rejected') return false;

      const reasons = check.flags.map((f) => FLAG_TEXT[f]).join(', ');
      const nameLine = `Facebook name: ${facebookName ?? ([check.first, check.last].filter(Boolean).join(' ') || '—')}`;
      const chat = (chatRow as { value?: string } | null)?.value;

      if (mode === 'observe') {
         const text = `👀 Facebook profile check (observe only, not rejected) — ${who(user)}\n${nameLine}\nWould reject: ${reasons}`;
         if (chat) await sendAdminCard(svc, chat, { kind: 'loan_access', refId: userId, text, keyboard: testAccountRow(userId) }).catch(() => null);
         return false;
      }

      // Conditional on not yet decided, so a team decision made at the same moment wins.
      const { data: rejected, error } = await svc
         .from('users')
         .update({ loan_access_status: 'rejected' })
         .eq('id', userId)
         .not('loan_access_status', 'in', '(approved,rejected)')
         .select(BORROWER_COLUMNS)
         .maybeSingle();
      if (error) throw new Error(error.message);
      if (!rejected) return false;
      const borrower = rejected as BorrowerRow;
      const now = new Date().toISOString();
      await svc
         .from('loan_access_requests')
         .update({ status: 'rejected', decided_at: now, decided_by: 'auto (Facebook profile)' })
         .eq('user_id', userId)
         .eq('status', 'pending');

      // Any card already about them shows the reject; then the auto-reject card with the undo buttons.
      await stampDecisionCards(svc, 'loan_access', userId, { header: `🚫 AUTO-REJECTED — ${reasons}`, by: 'auto (Facebook profile)' }, { final: false });
      const text = [
         `🚫 AUTO-REJECTED (Facebook profile) — ${who(borrower)}`,
         nameLine,
         `Why: ${reasons}`,
         `They were sent the "other lenders" message. Wrong call? Tap ✅ Approve after all.`
      ].join('\n');
      if (chat) {
         await sendAdminCard(svc, chat, { kind: 'loan_access', refId: userId, text, keyboard: rejectFollowUpButtons(userId) }).catch((err: unknown) =>
            console.error('facebookProfileCheck: telegram card failed', err instanceof Error ? err.message : err)
         );
      }
      await postDiscord({ content: text }, { prefer: ['DISCORD_KYC_WEBHOOK_URL'] }).catch(() => null);

      try {
         await cancelUpcomingCall(svc, userId, 'auto (Facebook profile)', { stamp: false });
      } catch (err) {
         console.error('facebookProfileCheck: cancel call failed', err instanceof Error ? err.message : err);
      }
      await notifyBorrower(svc, borrower, 'rejected_pre_call');
      return true;
   } catch (err) {
      console.error('facebookProfileCheck: auto-reject failed', err instanceof Error ? err.message : err);
      return false;
   }
};
