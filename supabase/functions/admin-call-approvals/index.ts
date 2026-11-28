import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { ATTENDANCE_COLUMNS, describeAttendance, zoomActiveForHost } from '../_shared/attendance.ts';
import { loadCallBrief, makeCallBrief } from '../_shared/callBrief.ts';
import { checkCallForm } from '../_shared/callFormCheck.ts';
import { getEffectiveCreditLimit, shiftCreditLevel } from '../_shared/creditAndPoints.ts';
import { postDiscord } from '../_shared/discord.ts';
import { fbStepsSentForCall } from '../_shared/facebookSteps.ts';
import { sendFacebookSteps } from '../_shared/facebookStepsSend.ts';
import {
   approveUser,
   BORROWER_COLUMNS,
   decideLoanAccess,
   rejectUser,
   REQUEST_COLUMNS,
   who
} from '../_shared/loanAccess.ts';
import { recordCallOutcome } from '../_shared/videoCallOutcome.ts';

// Call approvals in the admin panel — the same decisions as the Telegram card's buttons and
// /showed · /noshow · /approve · /reject, so the host can approve a borrower the moment the call
// ends instead of waiting for the "Did they show up?" card. Every decision goes through the same
// shared functions as Telegram (recordCallOutcome / decideLoanAccess), so the borrower gets the
// same message, a second tap from Telegram is a no-op, and the person's Telegram cards are stamped
// with the decision (adminCards.ts).
//
// Two actions (POST JSON):
//   { action: 'list' }                                        → { rows }
//   { action: 'decide', userId, decision: 'attended' | 'no_show' }      (video call)
//   { action: 'decide', requestId, decision: 'approved' | 'rejected' } (no-call approval request)
//   { action: 'approve_user', userId }  approve from the Directory, call or not: decides their pending
//                                       request if they have one, else approves them directly
//                                                             → { ok, summary }
//   { action: 'reject_user', userId }  call sheet "Lend to them?" = 1: rejects their pending request (or
//                                       them directly), same as Telegram's Reject  → { ok, summary }
//   { action: 'send_fb_steps', userId } send the "add Emma + join the group" message now (call sheet
//                                       button; also the only way on Cal Video calls)  → { ok, channel, sentAt }
//   { action: 'check_form', userId }    re-run the AI form check on their latest call transcript
//                                       (after the host edits the sheet)  → { ok, check }
//   { action: 'faces', userIds }      profile picture + pre-screening intro video + photos per person, so
//                                       the host knows the face before the call  → { faces: { [userId]: … } }
//   { action: 'brief', userId, refresh?, peek? }  the AI's "say this back to them" summary of everything we
//                                       know (saved; refresh makes a new one, peek never makes one)
//                                       → { brief, createdAt } | { brief: null }
//   { action: 'credit_level', userId, direction: 'up' | 'down' }  move their limit one ladder step
//                                       (mistakes, early repay) → { ok, summary, cs }
// verify_jwt is on; the caller must also be an active admin.

const CORS = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Calls from 30 days back: the Completed tab (approved / no-show / rejected) — George 2026-11-18:
// "hard to search for the previous calls". Only the last 2 days can still need a decision.
const LOOKBACK_H = 30 * 24;
// Two weeks ahead: every booked call is on the Calls tab (George 2026-11-15: "hard to keep track").
const LOOKAHEAD_H = 14 * 24;

const USER_COLUMNS = `${BORROWER_COLUMNS}, facebook_name, video_call_outcome, video_call_outcome_at, video_call_join_url, video_call_fb_steps_sent_at, ${ATTENDANCE_COLUMNS}`;

type UserRow = {
   id: string;
   username: string | null;
   email: string | null;
   display_name: string | null;
   facebook_name: string | null;
   loan_access_status: string | null;
   video_call_starts_at: string | null;
   video_call_outcome: string | null;
   video_call_outcome_at: string | null;
   video_call_join_url: string | null;
   video_call_fb_steps_sent_at: string | null;
   video_call_host: string | null;
   video_call_meeting_id: string | null;
   video_call_arrived_at: string | null;
   video_call_joined_at: string | null;
   video_call_left_at: string | null;
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// The picture a sign-in provider gave us (or the avatar they uploaded). https links only.
const profilePicture = (meta: Record<string, unknown> | null | undefined): string | null => {
   for (const key of ['avatar_url', 'picture', 'photo_url']) {
      const value = meta?.[key];
      if (typeof value === 'string' && /^https:\/\//i.test(value)) return value;
   }
   return null;
};
type RequestRow = { id: string; user_id: string; kind: string; display_name: string | null; reason: string | null; created_at: string };

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
   if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

   const svc = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
   if (!token) return json({ error: 'Missing authorization token' }, 401);
   const { data: userData, error: userError } = await svc.auth.getUser(token);
   const callerId = userData?.user?.id;
   if (userError || !callerId) return json({ error: 'Invalid session' }, 401);
   const { data: adminRow } = await svc
      .from('admin_users')
      .select('display_name')
      .eq('user_id', callerId)
      .eq('active', true)
      .in('role', ['owner', 'admin', 'support'])
      .maybeSingle();
   if (!adminRow) return json({ error: 'Forbidden: admin account required' }, 403);
   const decidedBy = `${(adminRow as { display_name: string | null }).display_name || userData.user?.email || 'admin'} (admin panel)`;

   const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

   try {
      if (body.action === 'list') {
         const now = Date.now();
         const [{ data: calls, error: callsError }, { data: pending, error: pendingError }] = await Promise.all([
            svc
               .from('users')
               .select(USER_COLUMNS)
               .not('video_call_booking_uid', 'is', null)
               .gt('video_call_starts_at', new Date(now - LOOKBACK_H * 3600000).toISOString())
               .lt('video_call_starts_at', new Date(now + LOOKAHEAD_H * 3600000).toISOString())
               .order('video_call_starts_at', { ascending: true })
               .limit(500),
            svc
               .from('loan_access_requests')
               .select(REQUEST_COLUMNS)
               .eq('status', 'pending')
               .order('created_at', { ascending: true })
               .limit(100)
         ]);
         if (callsError) throw new Error(callsError.message);
         if (pendingError) throw new Error(pendingError.message);

         const users = new Map<string, UserRow>(((calls ?? []) as UserRow[]).map((u) => [u.id, u]));
         const requests = (pending ?? []) as RequestRow[];
         const missing = requests.map((r) => r.user_id).filter((id) => !users.has(id));
         if (missing.length) {
            const { data: extra, error: extraError } = await svc.from('users').select(USER_COLUMNS).in('id', missing);
            if (extraError) throw new Error(extraError.message);
            for (const u of (extra ?? []) as UserRow[]) users.set(u.id, u);
         }
         const requestByUser = new Map(requests.map((r) => [r.user_id, r]));

         const zoomByHost = new Map<string, boolean>();
         const rows = [];
         for (const u of users.values()) {
            const host = u.video_call_host ?? '';
            if (!zoomByHost.has(host)) zoomByHost.set(host, await zoomActiveForHost(svc, host));
            const request = requestByUser.get(u.id) ?? null;
            rows.push({
               userId: u.id,
               name: who(u, request?.display_name),
               username: u.username,
               facebookName: u.facebook_name?.trim() || null,
               loanAccessStatus: u.loan_access_status,
               callStartsAt: u.video_call_starts_at,
               host: u.video_call_host,
               joinUrl: u.video_call_join_url,
               attendance: u.video_call_starts_at ? describeAttendance(u, zoomByHost.get(host) ?? false) : null,
               fbStepsSentAt: fbStepsSentForCall(u.video_call_fb_steps_sent_at, u.video_call_starts_at)
                  ? u.video_call_fb_steps_sent_at
                  : null,
               outcome: u.video_call_outcome,
               outcomeAt: u.video_call_outcome_at,
               request: request ? { id: request.id, kind: request.kind, reason: request.reason, createdAt: request.created_at } : null
            });
         }
         return json({ rows });
      }

      // What the borrower looks like, for the host before a call: their sign-in profile picture (Facebook /
      // Google / TikTok login, when they used one), their pre-screening intro video and the photos they
      // took there. Facebook does not give us a Page contact's photo, so this is the closest we have.
      // Storage links are signed for an hour; the panel keeps them and asks again only for new people.
      if (body.action === 'faces') {
         const ids = [...new Set((Array.isArray(body.userIds) ? body.userIds : []).filter((v): v is string => typeof v === 'string' && UUID_RE.test(v)))].slice(0, 40);
         if (!ids.length) return json({ faces: {} });
         const [{ data: screens, error: screensError }, { data: docs }, avatars] = await Promise.all([
            svc
               .from('pre_screenings')
               .select('user_id, answers, income_files, created_at')
               .in('user_id', ids)
               .is('files_removed_at', null)
               .order('created_at', { ascending: false }),
            // Proof of income they sent (payslips, bank statements, Messenger photos), newest first.
            svc.from('income_documents').select('user_id, files, doc_type, created_at').in('user_id', ids).order('created_at', { ascending: false }).limit(200),
            Promise.all(
               ids.map((id) =>
                  svc.auth.admin.getUserById(id).then(
                     (r) => [id, profilePicture(r.data?.user?.user_metadata)] as const,
                     () => [id, null] as const
                  )
               )
            )
         ]);
         if (screensError) throw new Error(screensError.message);
         // Newest pre-screening per person.
         const media = new Map<string, { clip: string | null; photos: { label: string; path: string }[] }>();
         // Proof files per person: [bucket, path, label, mime]. Up to 8 each, newest first.
         type ProofFile = { bucket: 'income-docs' | 'pre-screenings'; path: string; label: string; mime: string | null };
         const proof = new Map<string, ProofFile[]>();
         const addProof = (userId: string, file: ProofFile) => {
            const list = proof.get(userId) ?? [];
            if (list.length < 8 && !list.some((f) => f.path === file.path)) list.push(file);
            proof.set(userId, list);
         };
         const fileList = (value: unknown) =>
            (Array.isArray(value) ? value : []).filter(
               (f): f is { path: string; name?: string; mime?: string } => Boolean(f) && typeof (f as { path?: unknown }).path === 'string'
            );
         for (const doc of (docs ?? []) as { user_id: string; files: unknown; doc_type: string | null }[]) {
            for (const f of fileList(doc.files)) {
               addProof(doc.user_id, { bucket: 'income-docs', path: f.path, label: (doc.doc_type || 'Proof').replace(/_/g, ' '), mime: f.mime ?? null });
            }
         }
         for (const row of (screens ?? []) as { user_id: string; income_files: unknown }[]) {
            for (const f of fileList(row.income_files)) {
               addProof(row.user_id, { bucket: 'pre-screenings', path: f.path, label: 'Pre-screen proof', mime: f.mime ?? null });
            }
         }
         for (const row of (screens ?? []) as { user_id: string; answers: unknown }[]) {
            if (media.has(row.user_id)) continue;
            const entry = { clip: null as string | null, photos: [] as { label: string; path: string }[] };
            for (const a of Array.isArray(row.answers) ? (row.answers as Record<string, unknown>[]) : []) {
               const q = typeof a?.q === 'string' ? a.q : '';
               if (q === 'intro' && typeof a.video === 'string' && a.video) entry.clip = a.video;
               if (typeof a?.photo === 'string' && a.photo && entry.photos.length < 6) {
                  entry.photos.push({ label: q.startsWith('job') ? 'Job photo' : 'Photo', path: a.photo });
               }
            }
            media.set(row.user_id, entry);
         }
         const allProof = [...proof.values()].flat();
         const paths = [
            ...[...media.values()].flatMap((m) => [...(m.clip ? [m.clip] : []), ...m.photos.map((ph) => ph.path)]),
            ...allProof.filter((f) => f.bucket === 'pre-screenings').map((f) => f.path)
         ];
         const docPaths = allProof.filter((f) => f.bucket === 'income-docs').map((f) => f.path);
         const signedByPath = new Map<string, string>();
         const signedDocs = new Map<string, string>();
         const [screenSigned, docSigned] = await Promise.all([
            paths.length ? svc.storage.from('pre-screenings').createSignedUrls(paths, 3600) : Promise.resolve({ data: [] }),
            docPaths.length ? svc.storage.from('income-docs').createSignedUrls(docPaths, 3600) : Promise.resolve({ data: [] })
         ]);
         for (const item of screenSigned.data ?? []) if (item.path && item.signedUrl) signedByPath.set(item.path, item.signedUrl);
         for (const item of docSigned.data ?? []) if (item.path && item.signedUrl) signedDocs.set(item.path, item.signedUrl);
         const avatarById = new Map(avatars);
         const faces: Record<
            string,
            { avatar: string | null; clip: string | null; photos: { label: string; url: string }[]; proof: { label: string; url: string; image: boolean }[] }
         > = {};
         for (const id of ids) {
            const m = media.get(id);
            faces[id] = {
               avatar: avatarById.get(id) ?? null,
               clip: m?.clip ? (signedByPath.get(m.clip) ?? null) : null,
               photos: (m?.photos ?? []).flatMap((ph) => {
                  const url = signedByPath.get(ph.path);
                  return url ? [{ label: ph.label, url }] : [];
               }),
               proof: (proof.get(id) ?? []).flatMap((f) => {
                  const url = (f.bucket === 'income-docs' ? signedDocs : signedByPath).get(f.path);
                  const image = f.mime ? f.mime.startsWith('image/') : /\.(jpe?g|png|webp|gif|heic)$/i.test(f.path);
                  return url ? [{ label: f.label, url, image }] : [];
               })
            };
         }
         return json({ faces });
      }

      if (body.action === 'brief' && typeof body.userId === 'string' && UUID_RE.test(body.userId)) {
         const saved = body.refresh === true ? null : await loadCallBrief(svc, body.userId);
         if (saved) return json(saved);
         if (body.peek === true) return json({ brief: null });
         return json(await makeCallBrief(svc, body.userId));
      }

      if (body.action === 'decide') {
         const decision = body.decision;
         if ((decision === 'attended' || decision === 'no_show') && typeof body.userId === 'string') {
            const result = await recordCallOutcome(svc, body.userId, decision, decidedBy);
            return json(result);
         }
         if ((decision === 'approved' || decision === 'rejected') && typeof body.requestId === 'string') {
            const result = await decideLoanAccess(svc, body.requestId, decision, decidedBy);
            return json({ ok: result.ok, summary: result.summary });
         }
         return json({ error: 'Invalid decision' }, 400);
      }

      if (body.action === 'credit_level' && typeof body.userId === 'string' && (body.direction === 'up' || body.direction === 'down')) {
         const { data: row, error: readError } = await svc
            .from('users')
            .select('id, username, display_name, email, cs, created_at')
            .eq('id', body.userId)
            .maybeSingle();
         if (readError) throw new Error(readError.message);
         if (!row) return json({ ok: false, summary: 'User not found.' });
         const person = row as {
            id: string;
            username: string | null;
            display_name: string | null;
            email: string | null;
            cs: number | null;
            created_at: string | null;
         };
         const before = person.cs;
         const shown = getEffectiveCreditLimit(before, true);
         const next = shiftCreditLevel(before, body.direction, person.created_at);
         if (next === shown) {
            return json({
               ok: false,
               summary: `Already at the ${body.direction === 'up' ? 'top' : 'bottom'} ($${shown}) — nothing changed.`,
               cs: before
            });
         }
         // Compare-and-set on the value we read, so a repayment level-up landing at the same moment
         // isn't silently overwritten (same pattern as repaymentFollowUps.ts).
         const update = svc.from('users').update({ cs: next }).eq('id', body.userId);
         const { data: saved, error: saveError } = await (before === null ? update.is('cs', null) : update.eq('cs', before)).select('id');
         if (saveError) throw new Error(saveError.message);
         if (!saved?.length) return json({ ok: false, summary: 'Their limit just changed — reload and try again.' });
         const summary = `Credit limit $${shown} → $${next} for ${who(person)}.`;
         await postDiscord({ content: `🎚️ ${summary} (${decidedBy})` }, { prefer: ['DISCORD_BOOKINGS_WEBHOOK_URL'] });
         return json({ ok: true, summary, cs: next });
      }

      if (body.action === 'approve_user' && typeof body.userId === 'string') {
         return json(await approveUser(svc, body.userId, decidedBy));
      }

      if (body.action === 'reject_user' && typeof body.userId === 'string') {
         return json(await rejectUser(svc, body.userId, decidedBy));
      }

      if (body.action === 'check_form' && typeof body.userId === 'string') {
         const { data: latest } = await svc
            .from('call_transcripts')
            .select('id')
            .eq('user_id', body.userId)
            .order('call_started_at', { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();
         if (!latest) return json({ ok: false, error: 'No call transcript for this borrower yet.' }, 404);
         const check = await checkCallForm(svc, (latest as { id: string }).id);
         if (!check) return json({ ok: false, error: 'The form check failed. Try again in a minute.' }, 502);
         return json({ ok: true, check });
      }

      if (body.action === 'send_fb_steps' && typeof body.userId === 'string') {
         const { data: target } = await svc
            .from('users')
            .select('id, messenger_psid, chat_id, video_call_starts_at')
            .eq('id', body.userId)
            .maybeSingle();
         if (!target) return json({ ok: false, error: 'Borrower not found.' }, 404);
         const sent = await sendFacebookSteps(
            svc,
            target as { id: string; messenger_psid: string | null; chat_id: string | number | null; video_call_starts_at: string | null },
            { force: true }
         );
         if (!sent.ok) {
            const why =
               sent.reason === 'no_contact' || sent.reason === 'no_channel'
                  ? 'They have no Messenger or Telegram connected. Paste the two links in the Zoom chat.'
                  : 'Messenger could not deliver it (they may not have messaged the Page in the last 24 hours). Paste the two links in the Zoom chat.';
            return json({ ok: false, error: why }, 409);
         }
         return json({ ok: true, channel: sent.channel, sentAt: new Date().toISOString() });
      }

      return json({ error: 'Unknown action' }, 400);
   } catch (err) {
      console.error('admin-call-approvals:', err instanceof Error ? err.message : err);
      return json({ error: err instanceof Error ? err.message : 'Request failed' }, 500);
   }
});
