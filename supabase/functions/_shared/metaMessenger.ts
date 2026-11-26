// Messenger utility templates sent straight to Meta from our own app (Moodeng Messaging, 2672948996473335),
// not through SendPulse. SendPulse can only send templates from its dashboard, which needed a logged-in
// Mac (the relay). Tested 2026-11-25 in Graph API Explorer: our app may send `messaging_type: UTILITY`
// on the Moodeng Credit Page (app and Page are both in U-Bridge), and the only refusal was routing:
// "(#10) another app is controlling this thread". So each send takes control of that one conversation,
// sends, and gives control straight back to the app that had it (SendPulse), so the bot keeps working.
//
// Secrets live in the DB vault (edge secrets are at their cap), read via read_meta_secret():
//   META_PAGE_MESSAGING_TOKEN  Page token for the Moodeng Credit Page with pages_messaging + pages_utility_messaging
//   META_WEBHOOK_VERIFY_TOKEN  checked when Meta verifies our webhook (sendpulse-events?meta=1)

export const META_PAGE_ID = '1148756028310286';
const GRAPH = 'https://graph.facebook.com/v21.0';

// deno-lint-ignore no-explicit-any
type Svc = any;

export const readMetaSecret = async (svc: Svc, name: 'META_PAGE_MESSAGING_TOKEN' | 'META_WEBHOOK_VERIFY_TOKEN'): Promise<string> => {
   const { data, error } = await svc.rpc('read_meta_secret', { secret_name: name });
   if (error) console.error(`[meta] could not read ${name}`, error.message);
   return typeof data === 'string' ? data.trim() : '';
};

// Meta rejects template parameters containing '#', '%', '$' or emojis. "$20" → "20 USDC". Pure.
export const cleanTemplateParam = (value: unknown): string =>
   String(value ?? '')
      .replace(/\$\s*(\d[\d.,]*)/g, '$1 USDC')
      .replace(/[#%$]/g, '')
      .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

/** The Graph body for one utility template send. Pure. */
export const utilityTemplateBody = (psid: string, t: { name: string; language: string; params: string[] }) => ({
   recipient: { id: psid },
   messaging_type: 'UTILITY',
   message: {
      template: {
         name: t.name,
         language: { code: t.language },
         components: [{ type: 'body', parameters: t.params.map((p) => ({ type: 'text', text: cleanTemplateParam(p) })) }]
      }
   }
});

const graph = async (token: string, method: 'GET' | 'POST', path: string, body?: unknown) => {
   const url = `${GRAPH}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`;
   try {
      const res = await fetch(url, {
         method,
         headers: body ? { 'Content-Type': 'application/json' } : undefined,
         body: body ? JSON.stringify(body) : undefined
      });
      const json = await res.json().catch(() => null);
      return { ok: res.ok && !json?.error, status: res.status, json };
   } catch (err) {
      return { ok: false, status: 0, json: { error: { message: err instanceof Error ? err.message : String(err) } } };
   }
};

const errText = (r: { status: number; json: unknown }) => {
   const e = (r.json as { error?: { message?: string; code?: number; error_subcode?: number } } | null)?.error;
   return e ? `${e.code ?? r.status}/${e.error_subcode ?? '-'}: ${e.message ?? ''}`.slice(0, 300) : `HTTP ${r.status}`;
};

export type MetaSendResult = { ok: true; messageId: string | null; steps: string[] } | { ok: false; reason: string; steps: string[] };

/**
 * Sends one approved Messenger utility template to a Page-scoped id. Takes control of the thread if
 * another app holds it, and always tries to hand it back afterwards. Never throws.
 */
export const sendUtilityTemplate = async (
   svc: Svc,
   psid: string,
   t: { name: string; language?: string; params: string[] }
): Promise<MetaSendResult> => {
   const steps: string[] = [];
   if (!/^\d{5,25}$/.test(psid)) return { ok: false, reason: 'bad_psid', steps };
   const token = await readMetaSecret(svc, 'META_PAGE_MESSAGING_TOKEN');
   if (!token) return { ok: false, reason: 'no_token', steps };

   const owner = await graph(token, 'GET', `${META_PAGE_ID}/thread_owner?recipient=${psid}`);
   const ownerAppId: string | null = owner.ok ? (owner.json?.data?.[0]?.thread_owner?.app_id ?? null) : null;
   steps.push(owner.ok ? `owner=${ownerAppId ?? 'none'}` : `owner? ${errText(owner)}`);

   let took = false;
   const body = utilityTemplateBody(psid, { name: t.name, language: t.language ?? 'en', params: t.params });
   let sent = await graph(token, 'POST', `${META_PAGE_ID}/messages`, body);
   if (!sent.ok && (sent.json?.error?.code === 10 || sent.json?.error?.error_subcode === 2018300)) {
      // Another app (SendPulse) controls the conversation: take it for this one send.
      const take = await graph(token, 'POST', `${META_PAGE_ID}/take_thread_control`, {
         recipient: { id: psid },
         metadata: 'moodeng repay reminder'
      });
      steps.push(take.ok ? 'took control' : `take failed ${errText(take)}`);
      took = take.ok;
      if (took) sent = await graph(token, 'POST', `${META_PAGE_ID}/messages`, body);
   }
   steps.push(sent.ok ? 'sent' : `send failed ${errText(sent)}`);

   if (took && ownerAppId) {
      const back = await graph(token, 'POST', `${META_PAGE_ID}/pass_thread_control`, {
         recipient: { id: psid },
         target_app_id: ownerAppId,
         metadata: 'back to the bot'
      });
      steps.push(back.ok ? `passed back to ${ownerAppId}` : `pass back failed ${errText(back)}`);
   }
   console.log(`[meta] utility ${t.name} → ${psid.slice(0, 4)}…: ${steps.join(' | ')}`);
   return sent.ok ? { ok: true, messageId: sent.json?.message_id ?? null, steps } : { ok: false, reason: errText(sent), steps };
};

// Facebook's Page-scoped id for a SendPulse contact: the latest sender_id in our event log (same rule
// as private.messenger_meta_psid). Null when we never logged a message from them.
export const metaPsidForContact = async (svc: Svc, contactId: string): Promise<string | null> => {
   const { data } = await svc
      .from('messenger_contact_events')
      .select('payload')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(50);
   for (const row of (data ?? []) as Array<{ payload: { info?: { message?: { channel_data?: { sender_id?: unknown } } } } | null }>) {
      const id = String(row.payload?.info?.message?.channel_data?.sender_id ?? '');
      if (/^\d{5,25}$/.test(id) && id !== META_PAGE_ID) return id;
   }
   return null;
};

// Page utility templates (Graph POST /PAGE/message_templates, all Utility, English, "Open Moodeng" button
// to moodeng.app/dashboard). Created 2026-11-27 as the outside-24h fallback for messages that were
// Messenger free text only. Body variables:
//   moodeng_loan_funded       {{1}} name, {{2}} amount, {{3}} due date
//   moodeng_payment_received  {{1}} name, {{2}} amount
//   moodeng_reward_sent       {{1}} name, {{2}} what ("PHP 50 food voucher"), {{3}} where it went
//   moodeng_account_approved  {{1}} name
export const MESSENGER_TEMPLATES = {
   funded: 'moodeng_loan_funded',
   paymentReceived: 'moodeng_payment_received',
   rewardSent: 'moodeng_reward_sent',
   approved: 'moodeng_account_approved'
} as const;

/**
 * The outside-24h fallback for one SendPulse contact: finds their Page-scoped id (event log, else a
 * unique exact Facebook-name match) and sends the approved utility template. Never throws.
 */
export const sendTemplateToContact = async (
   svc: Svc,
   who: { contactId: string | null | undefined; facebookName?: string | null },
   t: { name: string; params: string[] }
): Promise<MetaSendResult> => {
   const psid =
      (who.contactId ? await metaPsidForContact(svc, who.contactId).catch(() => null) : null) ??
      (who.facebookName ? await findPsidByName(svc, who.facebookName).catch(() => null) : null);
   if (!psid) return { ok: false, reason: 'no_messenger_id', steps: [] };
   return sendUtilityTemplate(svc, psid, t);
};

/**
 * PSID by Facebook name from the Page's Messenger conversations, for people our event log never saw
 * (borrowers from before Oct 2026). Only an exact, unique name match counts: two people with the
 * same name → null, never a guess. Reads up to `maxPages` pages of 100 conversations. Never throws.
 */
export const findPsidByName = async (svc: Svc, name: string, maxPages = 8): Promise<string | null> => {
   const want = name.trim().toLowerCase().replace(/\s+/g, ' ');
   if (!want) return null;
   const token = await readMetaSecret(svc, 'META_PAGE_MESSAGING_TOKEN');
   if (!token) return null;
   const found = new Set<string>();
   let path: string | null = `${META_PAGE_ID}/conversations?platform=messenger&fields=participants&limit=100`;
   for (let i = 0; i < maxPages && path; i++) {
      const r = await graph(token, 'GET', path);
      if (!r.ok) break;
      for (const conv of (r.json?.data ?? []) as Array<{ participants?: { data?: Array<{ id?: string; name?: string }> } }>) {
         for (const p of conv.participants?.data ?? []) {
            if (p.id && p.id !== META_PAGE_ID && (p.name ?? '').trim().toLowerCase().replace(/\s+/g, ' ') === want) found.add(p.id);
         }
      }
      const next: string | undefined = r.json?.paging?.next;
      path = next ? next.replace(/^https:\/\/graph\.facebook\.com\/v[\d.]+\//, '').replace(/[?&]access_token=[^&]*/, '') : null;
   }
   return found.size === 1 ? [...found][0] : null;
};

/** Meta's webhook check (GET hub.mode=subscribe&hub.verify_token=…&hub.challenge=…). Null = not ours. */
export const metaWebhookChallenge = async (svc: Svc, url: URL): Promise<string | null> => {
   if (url.searchParams.get('hub.mode') !== 'subscribe') return null;
   const expected = await readMetaSecret(svc, 'META_WEBHOOK_VERIFY_TOKEN');
   if (!expected || url.searchParams.get('hub.verify_token') !== expected) return null;
   return url.searchParams.get('hub.challenge');
};
