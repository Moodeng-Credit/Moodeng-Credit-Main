import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkCronAuth } from '../_shared/cronAuth.ts';
import { postDiscord } from '../_shared/discord.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

// KYC cross-check. Pulls every Didit KYC session (declined attempts too), stores the identity Didit
// extracted from the ID (name, DOB, ID number, address + geocode), compares every account against
// every other, and reports NEW findings to Discord #kyc and the Telegram fraud group.
//
// Findings (all between DIFFERENT accounts unless noted):
//   🔴 same_document        same ID number
//   🔴 same_person          same name + date of birth
//   🔴 same_address         same street line + RT/RW, or geocodes within 50 m
//   🔴 multiple_ids         ONE account submitted IDs with different ID numbers (dio tried Christofer's)
//   🔴 didit_warning        Didit flagged a duplicate face / device / blocklist hit on the session
//   🟠 similar_address      street line ≥55% alike (OCR-tolerant) in the same NIK district; ≥72% + same RT/RW = 🔴
//   🟠 nearby_address       precise geocodes within 300 m
//   🟠 family_district      same surname + same NIK district (first 6 digits: province/city/kecamatan)
//
// Called daily by pg_cron with {"report":"daily"} (always posts a summary) and on demand with {}
// (posts only when there's something new). Pass {"refetch":true} to re-pull every session, and
// {"dry":true} to preview findings without posting or marking them reported.

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAME_ADDRESS_M = 50;
const NEARBY_M = 300;
const PRECISE_GEO = new Set(['ROOFTOP', 'RANGE_INTERPOLATED']);
const SKIP_STATUSES = new Set(['Not Started']);

type Identity = {
   session_id: string;
   vendor_data: string | null;
   user_id: string | null;
   session_status: string | null;
   session_created_at: string | null;
   full_name: string | null;
   first_name: string | null;
   last_name: string | null;
   date_of_birth: string | null;
   document_type: string | null;
   document_number: string | null;
   issuing_state: string | null;
   address: string | null;
   formatted_address: string | null;
   latitude: number | null;
   longitude: number | null;
   geo_precision: string | null;
   nik_district: string | null;
   warnings: string[];
};

type Finding = {
   kind: string;
   severity: 'red' | 'orange';
   session_a: string;
   session_b: string | null;
   user_a: string | null;
   user_b: string | null;
   detail: string;
   distance_m: number | null;
};

const norm = (value: string | null | undefined) =>
   (value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

const docKey = (value: string | null) => (value ?? '').replace(/[^0-9a-z]/gi, '').toUpperCase() || null;

// "CIATER PERMAI BLOK D.3/17, 004/004, CIATER, ..." -> "ciater permai blok d 3 17|004/004". The street
// line plus RT/RW identifies a house on an Indonesian KTP; the later segments (kelurahan, kecamatan)
// are OCR-noisy and shared by thousands, so they're left out.
const streetKey = (address: string | null) => {
   if (!address) return null;
   const parts = address.split(',').map((p) => p.trim());
   const street = norm(parts[0]);
   if (street.length < 6) return null;
   const rtRw = parts.slice(1, 3).find((p) => /^\d{1,3}\s*\/\s*\d{1,3}$/.test(p));
   return rtRw ? `${street}|${rtRw.replace(/\s/g, '')}` : street;
};

// KTP OCR mangles street names ("Ciater Permai Blok D.3/17" came back as "Ciatlnplrmaiblok D V17"),
// so exact matching misses real households. Dice similarity over character bigrams of the compacted
// street line tolerates that: on the Suganda cards the same house scored 0.59–0.89, unrelated streets
// 0.06–0.32. Only applied within the same NIK district, which keeps "Jl. Raya …" lookalikes apart.
const SIMILAR_STREET = 0.55;
const SAME_STREET = 0.72;
const compactStreet = (address: string | null) => norm(address?.split(',')[0]).replace(/ /g, '');
const rtRwOf = (address: string | null) =>
   address?.split(',').slice(1, 3).map((p) => p.trim()).find((p) => /^\d{1,3}\s*\/\s*\d{1,3}$/.test(p))?.replace(/\s/g, '') ?? null;
const streetSimilarity = (a: string, b: string) => {
   if (a.length < 8 || b.length < 8) return 0;
   const grams = (t: string) => {
      const counts = new Map<string, number>();
      for (let i = 0; i < t.length - 1; i++) counts.set(t.slice(i, i + 2), (counts.get(t.slice(i, i + 2)) ?? 0) + 1);
      return counts;
   };
   const ga = grams(a);
   const gb = grams(b);
   let shared = 0;
   for (const [g, n] of ga) shared += Math.min(n, gb.get(g) ?? 0);
   return (2 * shared) / (a.length - 1 + (b.length - 1));
};

const distanceM = (a: Identity, b: Identity) => {
   if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return null;
   const rad = Math.PI / 180;
   const dLat = (b.latitude - a.latitude) * rad;
   const dLng = (b.longitude - a.longitude) * rad;
   const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
   return Math.round(2 * 6371000 * Math.asin(Math.sqrt(h)));
};

// deno-lint-ignore no-explicit-any
const collectWarnings = (decision: any): string[] => {
   const codes = new Set<string>();
   // deno-lint-ignore no-explicit-any
   const visit = (list: any) => {
      if (!Array.isArray(list)) return;
      for (const item of list) {
         // deno-lint-ignore no-explicit-any
         for (const w of (item?.warnings ?? []) as any[]) {
            const code = typeof w === 'string' ? w : w?.risk ?? w?.code;
            if (typeof code === 'string') codes.add(code);
         }
      }
   };
   for (const key of ['id_verifications', 'face_matches', 'liveness_checks', 'ip_analyses', 'nfc_verifications']) visit(decision?.[key]);
   return [...codes];
};

// deno-lint-ignore no-explicit-any
const toIdentity = (decision: any, userIds: Set<string>): Identity => {
   const iv = decision?.id_verifications?.[0] ?? null;
   const parsed = iv?.parsed_address ?? null;
   const location = parsed?.raw_results?.geometry?.location ?? null;
   const docNumber = docKey(iv?.document_number ?? iv?.personal_number ?? null);
   const vendorData = typeof decision?.vendor_data === 'string' ? decision.vendor_data : null;
   return {
      session_id: decision.session_id,
      vendor_data: vendorData,
      user_id: vendorData && UUID_RE.test(vendorData) && userIds.has(vendorData) ? vendorData : null,
      session_status: decision?.status ?? null,
      session_created_at: decision?.created_at ?? null,
      full_name: iv?.full_name ?? null,
      first_name: iv?.first_name ?? null,
      // Didit writes "N/A" when the ID has a single name (common on Indonesian KTPs).
      last_name: iv?.last_name && !/^n\/?a$/i.test(iv.last_name.trim()) ? iv.last_name : null,
      date_of_birth: iv?.date_of_birth ?? null,
      document_type: iv?.document_type ?? null,
      document_number: docNumber,
      issuing_state: iv?.issuing_state ?? null,
      address: iv?.address ?? null,
      formatted_address: iv?.formatted_address ?? parsed?.formatted_address ?? null,
      latitude: typeof location?.lat === 'number' ? location.lat : null,
      longitude: typeof location?.lng === 'number' ? location.lng : null,
      geo_precision: parsed?.raw_results?.geometry?.location_type ?? null,
      nik_district: iv?.issuing_state === 'IDN' && docNumber && /^\d{16}$/.test(docNumber) ? docNumber.slice(0, 6) : null,
      warnings: collectWarnings(decision)
   };
};

const findMatches = (identities: Identity[]): Finding[] => {
   const findings: Finding[] = [];
   const owner = (i: Identity) => i.user_id ?? i.vendor_data ?? i.session_id;
   const withDocs = identities.filter((i) => i.document_number || i.address || i.full_name);

   for (const i of identities) {
      const flagged = i.warnings.filter((w) => /DUPLICATED|BLOCKLIST/i.test(w));
      if (flagged.length) {
         findings.push({
            kind: 'didit_warning',
            severity: 'red',
            session_a: i.session_id,
            session_b: null,
            user_a: i.user_id,
            user_b: null,
            detail: `Didit flagged: ${flagged.join(', ')}`,
            distance_m: null
         });
      }
   }

   for (let x = 0; x < withDocs.length; x++) {
      for (let y = x + 1; y < withDocs.length; y++) {
         // Order each pair by session id so the unique index dedupes it across runs.
         const [a, b] = withDocs[x].session_id < withDocs[y].session_id ? [withDocs[x], withDocs[y]] : [withDocs[y], withDocs[x]];
         const base = { session_a: a.session_id, session_b: b.session_id, user_a: a.user_id, user_b: b.user_id };

         if (owner(a) === owner(b)) {
            // Same account: only interesting if it tried more than one identity.
            if (a.document_number && b.document_number && a.document_number !== b.document_number) {
               findings.push({
                  ...base,
                  kind: 'multiple_ids',
                  severity: 'red',
                  detail: `One account submitted two different IDs: ${a.full_name ?? '?'} and ${b.full_name ?? '?'}`,
                  distance_m: null
               });
            }
            continue;
         }

         if (a.document_number && a.document_number === b.document_number) {
            findings.push({ ...base, kind: 'same_document', severity: 'red', detail: `Same ID number (${a.full_name ?? '?'})`, distance_m: null });
         }
         if (a.full_name && a.date_of_birth && norm(a.full_name) === norm(b.full_name) && a.date_of_birth === b.date_of_birth) {
            findings.push({ ...base, kind: 'same_person', severity: 'red', detail: `Same name + date of birth: ${a.full_name}, ${a.date_of_birth}`, distance_m: null });
         }

         const precise = PRECISE_GEO.has(a.geo_precision ?? '') && PRECISE_GEO.has(b.geo_precision ?? '');
         const meters = precise ? distanceM(a, b) : null;
         const sameStreet = streetKey(a.address) !== null && streetKey(a.address) === streetKey(b.address);
         if (sameStreet || (meters !== null && meters <= SAME_ADDRESS_M)) {
            findings.push({
               ...base,
               kind: 'same_address',
               severity: 'red',
               detail: `Same address: ${a.address ?? a.formatted_address ?? '?'}`,
               distance_m: meters
            });
         } else if (
            a.nik_district &&
            a.nik_district === b.nik_district &&
            streetSimilarity(compactStreet(a.address), compactStreet(b.address)) >= SIMILAR_STREET
         ) {
            const score = streetSimilarity(compactStreet(a.address), compactStreet(b.address));
            const rtA = rtRwOf(a.address);
            const rtB = rtRwOf(b.address);
            const sameHouse = score >= SAME_STREET && (!rtA || !rtB || rtA === rtB);
            findings.push({
               ...base,
               kind: sameHouse ? 'same_address' : 'similar_address',
               severity: sameHouse ? 'red' : 'orange',
               detail: `${sameHouse ? 'Same address' : 'Very similar address'} (${Math.round(score * 100)}% match, same district): ${a.address ?? '?'} / ${b.address ?? '?'}`,
               distance_m: meters
            });
         } else if (meters !== null && meters <= NEARBY_M) {
            findings.push({
               ...base,
               kind: 'nearby_address',
               severity: 'orange',
               detail: `Addresses ${meters} m apart: ${a.formatted_address ?? a.address ?? '?'} / ${b.formatted_address ?? b.address ?? '?'}`,
               distance_m: meters
            });
         }

         const surnameA = norm(a.last_name);
         if (a.nik_district && a.nik_district === b.nik_district && surnameA.length >= 3 && surnameA === norm(b.last_name)) {
            findings.push({
               ...base,
               kind: 'family_district',
               severity: 'orange',
               detail: `Same surname "${a.last_name}" in the same district (NIK ${a.nik_district}…)`,
               distance_m: null
            });
         }
      }
   }
   return findings;
};

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
   if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

   const auth = checkCronAuth(req, Deno.env.get('ADMIN_API_TOKEN'), corsHeaders);
   if (!auth.ok) return auth.response;

   const body = (await req.json().catch(() => ({}))) as { report?: string; refetch?: boolean; dry?: boolean };
   const dailyReport = body.report === 'daily';

   const apiKey = Deno.env.get('DIDIT_API_KEY');
   if (!apiKey) return jsonResponse({ error: 'DIDIT_API_KEY not configured' }, 500);
   const apiBase = (Deno.env.get('DIDIT_API_BASE')?.trim() || 'https://verification.didit.me/v3').replace(/\/$/, '');
   const diditHeaders = { 'x-api-key': apiKey, Accept: 'application/json' };

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   // ---- 1. Every KYC session Didit has --------------------------------------------------------------
   const sessions: { session_id: string; status: string }[] = [];
   let next: string | null = `${apiBase}/sessions/?session_kind=user&limit=100`;
   while (next) {
      const res: Response = await fetch(next, { headers: diditHeaders });
      if (!res.ok) return jsonResponse({ error: `Didit list failed: ${res.status} ${await res.text()}` }, 502);
      const page: { results?: { session_id: string; status: string }[]; next?: string | null } = await res.json();
      for (const s of page.results ?? []) sessions.push({ session_id: s.session_id, status: s.status });
      next = page.next ?? null;
   }

   // ---- 2. Fetch decisions we don't have yet (or whose status changed) -------------------------------
   const { data: stored } = await supabase.from('kyc_identities').select('session_id, session_status');
   const storedStatus = new Map((stored ?? []).map((r) => [r.session_id, r.session_status]));
   const toFetch = sessions.filter(
      (s) => !SKIP_STATUSES.has(s.status) && (body.refetch || storedStatus.get(s.session_id) !== s.status)
   );

   const { data: userRows } = await supabase.from('users').select('id, username');
   const usernames = new Map((userRows ?? []).map((u) => [u.id, u.username as string]));
   const userIds = new Set(usernames.keys());

   const fetched: Identity[] = [];
   const fetchErrors: string[] = [];
   for (let i = 0; i < toFetch.length; i += 5) {
      await Promise.all(
         toFetch.slice(i, i + 5).map(async (s) => {
            const res = await fetch(`${apiBase}/session/${s.session_id}/decision/`, { headers: diditHeaders });
            if (!res.ok) {
               fetchErrors.push(`${s.session_id}: ${res.status}`);
               return;
            }
            fetched.push(toIdentity(await res.json(), userIds));
         })
      );
   }
   if (fetched.length) {
      const { error } = await supabase
         .from('kyc_identities')
         .upsert(fetched.map((f) => ({ ...f, fetched_at: new Date().toISOString() })), { onConflict: 'session_id' });
      if (error) return jsonResponse({ error: `store identities: ${error.message}` }, 500);
   }

   // ---- 3. Compare everyone, keep what's new ----------------------------------------------------------
   const { data: all } = await supabase.from('kyc_identities').select('*');
   const findings = findMatches((all ?? []) as Identity[]);
   if (findings.length) {
      const { error } = await supabase
         .from('kyc_identity_matches')
         .upsert(
            findings.map((f) => ({ ...f, pair_key: `${f.kind}:${f.session_a}:${f.session_b ?? '-'}` })),
            { onConflict: 'pair_key', ignoreDuplicates: true }
         );
      if (error) return jsonResponse({ error: `store matches: ${error.message}` }, 500);
   }
   const { data: unreported } = await supabase
      .from('kyc_identity_matches')
      .select('id, kind, severity, user_a, user_b, detail, distance_m, session_a, session_b')
      .is('reported_at', null)
      .order('severity', { ascending: false })
      .order('created_at', { ascending: true });
   const newFindings = unreported ?? [];

   // ---- 4. Report --------------------------------------------------------------------------------------
   const who = (id: string | null, session: string | null) =>
      id ? usernames.get(id) ?? id.slice(0, 8) : session ? `session ${session.slice(0, 8)} (no account)` : '—';
   // Several KYC attempts per account would repeat a finding once per session pair — collapse to one
   // line per kind per pair of accounts.
   const grouped = new Map<string, { line: string; count: number }>();
   for (const f of newFindings) {
      const owners = [f.user_a ?? f.session_a, f.user_b ?? f.session_b ?? ''].sort().join('|');
      const key = `${f.kind}|${owners}`;
      const existing = grouped.get(key);
      if (existing) {
         existing.count += 1;
         continue;
      }
      const icon = f.severity === 'red' ? '🔴' : '🟠';
      const pair = f.session_b ? `**${who(f.user_a, f.session_a)}** ↔ **${who(f.user_b, f.session_b)}**` : `**${who(f.user_a, f.session_a)}**`;
      grouped.set(key, { line: `${icon} ${pair} — ${f.detail}`, count: 1 });
   }
   const lines = [...grouped.values()].map((g) => (g.count > 1 ? `${g.line} (×${g.count} attempts)` : g.line));
   const red = newFindings.filter((f) => f.severity === 'red').length;
   const orange = newFindings.length - red;
   const withDocs = (all ?? []).filter((i) => i.document_number).length;
   const summary =
      `Scanned ${sessions.length} Didit sessions (${fetched.length} new/updated, ${withDocs} with an ID). ` +
      (newFindings.length ? `**${newFindings.length} new finding${newFindings.length === 1 ? '' : 's'}** — ${red} 🔴, ${orange} 🟠.` : 'No new findings.');

   // dry: store and compare, but post nothing and leave findings unreported (for previewing a run).
   if (!body.dry && (newFindings.length || dailyReport)) {
      const chunks: string[] = [];
      let current = '';
      for (const line of lines) {
         if ((current + '\n' + line).length > 3800) {
            chunks.push(current);
            current = line;
         } else current = current ? `${current}\n${line}` : line;
      }
      if (current) chunks.push(current);

      await postDiscord(
         {
            embeds: [
               {
                  title: dailyReport ? '🛡️ Daily KYC cross-check' : '🛡️ KYC cross-check — new findings',
                  description: `${summary}${chunks[0] ? `\n\n${chunks[0]}` : ''}`,
                  color: red ? 0xe74c3c : orange ? 0xf39c12 : 0x2ecc71,
                  timestamp: new Date().toISOString()
               }
            ]
         },
         { prefer: ['DISCORD_KYC_WEBHOOK_URL'] }
      );
      for (const chunk of chunks.slice(1)) {
         await postDiscord({ embeds: [{ description: chunk, color: red ? 0xe74c3c : 0xf39c12 }] }, { prefer: ['DISCORD_KYC_WEBHOOK_URL'] });
      }

      if (newFindings.length) {
         const { data: chat } = await supabase.from('telegram_bot_settings').select('value').eq('key', 'fraud_alert_chat_id').maybeSingle();
         if (chat?.value) {
            const plain = [`🛡️ KYC cross-check: ${newFindings.length} new (${red} red, ${orange} orange)`, ...lines.slice(0, 25).map((l) => l.replace(/\*\*/g, ''))];
            if (lines.length > 25) plain.push(`…and ${lines.length - 25} more in Discord #kyc`);
            try {
               await sendTelegramMessage(chat.value, plain.join('\n'));
            } catch (e) {
               console.error('[kyc-cross-check] telegram failed:', e instanceof Error ? e.message : e);
            }
         }
      }

      if (newFindings.length) {
         await supabase
            .from('kyc_identity_matches')
            .update({ reported_at: new Date().toISOString() })
            .in(
               'id',
               newFindings.map((f) => f.id)
            );
      }
   }

   return jsonResponse({
      ok: true,
      sessions: sessions.length,
      fetched: fetched.length,
      fetch_errors: fetchErrors,
      identities_with_id: withDocs,
      new_findings: newFindings.length,
      ...(body.dry ? { preview: lines } : {}),
      red,
      orange
   });
});
