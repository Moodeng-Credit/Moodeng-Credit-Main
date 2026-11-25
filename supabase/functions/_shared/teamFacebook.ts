// Every team Telegram post that names a borrower also shows their Facebook name and a link (George
// 2026-11-21, after a "Couldn't reach" alert for someone whose Facebook name was nothing like their
// real name). Done once, inside callTelegramApi, so every team alert gets it without each sender
// remembering: the borrower is found by the @username or email already in the text (exactly one
// account, or nothing), or passed explicitly as aboutUserIds when the text has neither.
//
// Only team chats (telegram_bot_settings *_chat_id, minus the lender group) — never a borrower's own
// chat or the lender group. Never blocks a post: any failure sends the text unchanged.

export type FacebookPerson = {
   id: string;
   username?: string | null;
   telegram_username?: string | null;
   email?: string | null;
   facebook_name?: string | null;
   facebook_profile_url?: string | null;
   messenger_psid?: string | null;
};

const MAX_TEXT = 4096;
const MARK = '👤 Facebook';

// Same as messengerChatUrl in sendpulse.ts (users.messenger_psid holds the SendPulse contact id).
// Copied, not imported, so telegram.ts doesn't pull in the SendPulse module.
const sendpulseChatUrl = (contactId: string) =>
   `https://login.sendpulse.com/chatbots/chats?contact_id=${encodeURIComponent(contactId)}&channel=messenger`;

/** The profile when we have it (rare), else their Messenger chat with our Page in SendPulse. Pure. */
export const facebookLink = (p: FacebookPerson): string | null =>
   p.facebook_profile_url?.trim() || (p.messenger_psid?.trim() ? sendpulseChatUrl(p.messenger_psid.trim()) : null);

/** "👤 Facebook: <name> — <link>", labelled with @username when the post names several people. Pure. */
export const facebookLine = (p: FacebookPerson, labelled = false): string | null => {
   const name = p.facebook_name?.trim() || null;
   const link = facebookLink(p);
   if (!name && !link) return null;
   const who = labelled && p.username ? ` (@${p.username})` : '';
   return `${MARK}${who}: ${name ?? 'name not saved'}${link ? ` — ${link}` : ' — no Messenger chat yet'}`;
};

// @handles not glued to a word (so emails don't count) and emails, lowercased, in order of appearance. Pure.
export const mentionsIn = (text: string) => {
   const emails = [...new Set([...text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)].map((m) => m[0].toLowerCase()))];
   const handles = [
      ...new Set([...text.matchAll(/(?<![\w.@])@([A-Za-z0-9_.]{3,40})/g)].map((m) => m[1].replace(/\.+$/, '').toLowerCase()))
   ];
   return { handles, emails };
};

const norm = (v: string | null | undefined) => (v ?? '').trim().replace(/^@/, '').toLowerCase();

/** Which accounts the text is about: explicit ids first, then each handle/email that fits exactly one account. Pure. */
export const pickPeople = (text: string, people: FacebookPerson[], aboutUserIds: string[] = []): FacebookPerson[] => {
   const { handles, emails } = mentionsIn(text);
   const out: FacebookPerson[] = [];
   const add = (p?: FacebookPerson) => p && !out.some((o) => o.id === p.id) && out.push(p);
   for (const id of aboutUserIds) add(people.find((p) => p.id === id));
   for (const h of handles) {
      const hits = people.filter((p) => norm(p.username) === h || norm(p.telegram_username) === h);
      if (hits.length === 1) add(hits[0]);
   }
   for (const e of emails) {
      const hits = people.filter((p) => norm(p.email) === e);
      if (hits.length === 1) add(hits[0]);
   }
   return out;
};

/** The text with a Facebook line per person (skipping anyone whose link is already in it), kept under Telegram's limit. Pure. */
export const addFacebookLines = (text: string, people: FacebookPerson[]): string => {
   const labelled = people.length > 1;
   const lines: string[] = [];
   for (const p of people) {
      const link = facebookLink(p);
      if (link && text.includes(link)) continue;
      const line = facebookLine(p, labelled);
      if (line && !text.includes(line)) lines.push(line);
   }
   while (lines.length && text.length + 2 + lines.join('\n').length > MAX_TEXT) lines.pop();
   return lines.length ? `${text}\n\n${lines.join('\n')}` : text;
};

// ---- Lookups (REST, so telegram.ts stays free of supabase-js) -------------------------------------

const rest = async <T>(path: string): Promise<T | null> => {
   const url = Deno.env.get('SUPABASE_URL');
   const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
   if (!url || !key) return null;
   const res = await fetch(`${url}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(3000)
   });
   return res.ok ? ((await res.json()) as T) : null;
};

const NOT_TEAM = new Set(['lender_group_chat_id']);
let teamChats: { ids: Set<string>; at: number } | null = null;

const teamChatIds = async (): Promise<Set<string>> => {
   if (teamChats && Date.now() - teamChats.at < 5 * 60_000) return teamChats.ids;
   const rows = (await rest<Array<{ key: string; value: unknown }>>('telegram_bot_settings?select=key,value&key=like.*_chat_id')) ?? [];
   const ids = new Set<string>();
   for (const r of rows) if (!NOT_TEAM.has(r.key) && r.value != null) ids.add(String(r.value).replace(/"/g, '').trim());
   for (const env of ['TEAM_TELEGRAM_CHAT_ID', 'TELEGRAM_TEAM_GROUP_CHAT_ID', 'FRAUD_ALERT_TELEGRAM_CHAT_ID']) {
      const v = Deno.env.get(env)?.trim();
      if (v) ids.add(v);
   }
   ids.delete('');
   teamChats = { ids, at: Date.now() };
   return ids;
};

const quote = (v: string) => `"${v.replace(/["\\]/g, '')}"`;

const lookUpPeople = async (handles: string[], emails: string[], ids: string[]): Promise<FacebookPerson[]> => {
   const ors = [
      // ilike so case doesn't matter; pickPeople re-checks exact equality (ilike treats _ as a wildcard).
      ...handles.flatMap((h) => [
         `username.ilike.${quote(h)}`,
         `telegram_username.ilike.${quote(h)}`,
         `telegram_username.ilike.${quote('@' + h)}`
      ]),
      ...emails.map((e) => `email.ilike.${quote(e)}`),
      ...(ids.length ? [`id.in.(${ids.map(quote).join(',')})`] : [])
   ];
   if (!ors.length) return [];
   const params = new URLSearchParams({
      select: 'id,username,telegram_username,email,facebook_name,facebook_profile_url,messenger_psid',
      or: `(${ors.join(',')})`,
      limit: '50'
   });
   return (await rest<FacebookPerson[]>(`users?${params}`)) ?? [];
};

/**
 * A team post as it will go out: the text (with Facebook lines) and who it's about, for the post log.
 * `about` = ids the sender passed; `mentioned` = people found by @username/email in the text (may
 * include team members — log_team_post drops those). Never throws; `team` false outside team chats.
 */
export type TeamPost = { text: string; team: boolean; about: string[]; mentioned: string[] };

export const teamPost = async (chatId: unknown, text: string, aboutUserIds: string[] = []): Promise<TeamPost> => {
   const plain: TeamPost = { text, team: false, about: [], mentioned: [] };
   try {
      if (chatId == null || !text) return plain;
      if (!(await teamChatIds()).has(String(chatId).trim())) return plain;
      const { handles, emails } = mentionsIn(text);
      if (!handles.length && !emails.length && !aboutUserIds.length) return { ...plain, team: true };
      const people = await lookUpPeople(handles.slice(0, 10), emails.slice(0, 10), aboutUserIds.slice(0, 10));
      const picked = pickPeople(text, people, aboutUserIds);
      return {
         text: addFacebookLines(text, picked),
         team: true,
         about: aboutUserIds.filter((id) => picked.some((p) => p.id === id)),
         mentioned: picked.map((p) => p.id).filter((id) => !aboutUserIds.includes(id))
      };
   } catch (err) {
      console.warn('teamFacebook: skipped', err instanceof Error ? err.message : err);
      return plain;
   }
};

/** For callTelegramApi: the text to post in this chat. Never throws; unchanged outside team chats. */
export const withTeamFacebook = async (chatId: unknown, text: string, aboutUserIds: string[] = []): Promise<string> =>
   (await teamPost(chatId, text, aboutUserIds)).text;

/**
 * Saves a sent team post on the person's Admin page (public.log_team_post decides what's kept,
 * folded or skipped — see migration 20261125090000_team_post_log.sql). Never throws, never slows a
 * post by more than ~2.5s, and does nothing if the database function isn't there.
 */
export const logTeamPost = async (post: TeamPost, chatId: unknown, messageId: unknown, isEdit: boolean): Promise<void> => {
   try {
      if (!post.team || (!post.about.length && !post.mentioned.length)) return;
      const url = Deno.env.get('SUPABASE_URL');
      const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !key) return;
      const res = await fetch(`${url}/rest/v1/rpc/log_team_post`, {
         method: 'POST',
         headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
         body: JSON.stringify({
            p_chat_id: String(chatId),
            p_message_id: typeof messageId === 'number' ? messageId : null,
            p_text: post.text,
            p_about: post.about,
            p_mentioned: post.mentioned,
            p_is_edit: isEdit
         }),
         signal: AbortSignal.timeout(2500)
      });
      if (!res.ok) console.warn('teamPostLog: not saved', res.status);
   } catch (err) {
      console.warn('teamPostLog: skipped', err instanceof Error ? err.message : err);
   }
};
