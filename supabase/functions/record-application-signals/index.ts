import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// One-way salted hash, same construction as the IP path — we never store the
// raw device fingerprint the client computed, only a salted hash of it, so the
// device value is comparable across accounts without being reversible.
const hashValue = async (value: string, salt: string) => {
   const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${value}`));
   return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
};

type Body = {
   loanId?: string;
   lat?: number | null;
   lon?: number | null;
   accuracy?: number | null;
   gpsStatus?: string | null;
   deviceRaw?: string | null;
};

const GPS_STATUSES = new Set(['granted', 'denied', 'unavailable', 'timeout']);

// Two applications count as "same place" within this radius. Loose enough to
// catch a shared home/room, tight enough that a whole city block doesn't trip.
const COLOCATION_RADIUS_M = 100;

// Great-circle distance in metres between two lat/lon points.
const haversineMeters = (aLat: number, aLon: number, bLat: number, bLon: number): number => {
   const R = 6371000;
   const dLat = ((bLat - aLat) * Math.PI) / 180;
   const dLon = ((bLon - aLon) * Math.PI) / 180;
   const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
   return 2 * R * Math.asin(Math.sqrt(s));
};

// Fire a fraud alert to the security Discord channel. Best-effort — never lets a
// delivery failure affect the request. This is an ALERT for a human to review,
// not an automatic block (co-location has innocent explanations too).
const postFraudAlert = async (details: {
   username: string | null;
   email: string | null;
   loanAmount: number | null;
   trackingId: string | null;
   reasons: string[];
}) => {
   const webhook = Deno.env.get('DISCORD_SECURITY_WEBHOOK_URL');
   if (!webhook) return;
   const { username, email, loanAmount, trackingId, reasons } = details;
   const embed = {
      title: '🚨 Application flagged for review',
      color: 0xe74c3c,
      fields: [
         { name: 'Borrower', value: `${username ?? '—'}\n${email ?? '—'}`, inline: true },
         {
            name: 'Loan',
            value: `${loanAmount != null ? `$${loanAmount}` : '—'}\n${trackingId ?? '—'}`,
            inline: true
         },
         { name: 'Why', value: reasons.map((r) => `• ${r}`).join('\n'), inline: false }
      ],
      footer: { text: 'Captured at application — before funding' },
      timestamp: new Date().toISOString()
   };
   try {
      await fetch(webhook, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ embeds: [embed] })
      });
   } catch {
      // Swallow — alerting is best-effort.
   }
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }
   if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
   }

   const salt = Deno.env.get('IP_HASH_SALT');
   // Fail safe: without a salt we'd store a weak/raw hash — do nothing instead.
   if (!salt) {
      return new Response(JSON.stringify({ ok: false, skipped: 'no-salt' }), { status: 200, headers: corsHeaders });
   }

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   // Identify the caller from their JWT — never trust a client-supplied user id.
   const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
   const { data: userData } = await supabase.auth.getUser(token);
   const userId = userData?.user?.id;
   if (!userId) {
      return new Response(JSON.stringify({ ok: false, skipped: 'unauthenticated' }), { status: 200, headers: corsHeaders });
   }

   let body: Body;
   try {
      body = await req.json();
   } catch {
      return new Response(JSON.stringify({ ok: false, skipped: 'bad-body' }), { status: 200, headers: corsHeaders });
   }

   const loanId = body.loanId;
   if (!loanId) {
      return new Response(JSON.stringify({ ok: false, skipped: 'no-loan' }), { status: 200, headers: corsHeaders });
   }

   // The loan must exist and belong to this caller — otherwise a user could
   // attach signals to someone else's application.
   const { data: loan } = await supabase
      .from('loans')
      .select('id, borrower_user_id, loan_amount, tracking_id')
      .eq('id', loanId)
      .maybeSingle();
   if (!loan || loan.borrower_user_id !== userId) {
      return new Response(JSON.stringify({ ok: false, skipped: 'loan-not-owned' }), { status: 200, headers: corsHeaders });
   }

   // Salt the device fingerprint (if the client managed to compute one).
   const deviceRaw = typeof body.deviceRaw === 'string' && body.deviceRaw.length > 0 ? body.deviceRaw : null;
   const deviceHash = deviceRaw ? await hashValue(deviceRaw, salt) : null;

   const gpsStatus = typeof body.gpsStatus === 'string' && GPS_STATUSES.has(body.gpsStatus)
      ? body.gpsStatus
      : 'unavailable';
   const lat = typeof body.lat === 'number' ? body.lat : null;
   const lon = typeof body.lon === 'number' ? body.lon : null;
   const accuracy = typeof body.accuracy === 'number' ? body.accuracy : null;

   // One signal row per loan application.
   const { error: sigErr } = await supabase.from('loan_application_signals').upsert(
      {
         loan_id: loanId,
         borrower_user_id: userId,
         app_lat: lat,
         app_lon: lon,
         app_gps_accuracy: accuracy,
         app_gps_status: gpsStatus,
         device_hash: deviceHash
      },
      { onConflict: 'loan_id' }
   );
   if (sigErr) {
      return new Response(JSON.stringify({ ok: false, error: sigErr.message }), { status: 200, headers: corsHeaders });
   }

   // Also fold the device hash into the per-user/day device log, so device-farm
   // detection (one device across many accounts) sees application devices too.
   if (deviceHash) {
      const today = new Date().toISOString().slice(0, 10);
      await supabase.from('auth_device_log').upsert(
         { user_id: userId, device_hash: deviceHash, seen_on: today, last_seen_at: new Date().toISOString() },
         { onConflict: 'user_id,device_hash,seen_on' }
      );
   }

   // -------------------------------------------------------------------------
   // Real-time application vetting — runs BEFORE this request can be funded.
   // Tripped signals both (a) fire a Discord alert and (b) land in the admin
   // Fraud Alert Queue (fraud_signal_alerts) with the open/confirm/ignore
   // workflow — and those human verdicts become the labels for a model later.
   // -------------------------------------------------------------------------
   const reasons: string[] = [];
   let deviceOthers = 0;
   let coloc: { count: number; minD: number } | null = null;

   // A) Shared device — this physical device already logged in under other
   //    accounts. The core mule-farm signal (one phone, many "borrowers").
   if (deviceHash) {
      const { data: deviceRows } = await supabase
         .from('auth_device_log')
         .select('user_id')
         .eq('device_hash', deviceHash)
         .neq('user_id', userId);
      deviceOthers = new Set((deviceRows ?? []).map((r) => r.user_id)).size;
      if (deviceOthers > 0) {
         reasons.push(`📱 Device shared with ${deviceOthers} other account${deviceOthers > 1 ? 's' : ''}`);
      }
   }

   // B) GPS co-location — another borrower applied from within ~100m. Catches
   //    two accounts driven from the same room (e.g. a coerced applicant next
   //    to the person actually taking the money). Bounding-box prefilter, then
   //    exact great-circle distance on the handful of candidates.
   if (lat !== null && lon !== null && gpsStatus === 'granted') {
      const delta = 0.0015; // ~150m lat/lon box around the applicant
      const { data: nearRows } = await supabase
         .from('loan_application_signals')
         .select('borrower_user_id, app_lat, app_lon')
         .neq('borrower_user_id', userId)
         .not('app_lat', 'is', null)
         .not('app_lon', 'is', null)
         .gte('app_lat', lat - delta)
         .lte('app_lat', lat + delta)
         .gte('app_lon', lon - delta)
         .lte('app_lon', lon + delta);
      const near = (nearRows ?? [])
         .map((r) => ({
            uid: r.borrower_user_id as string | null,
            d: haversineMeters(lat, lon, r.app_lat as number, r.app_lon as number)
         }))
         .filter((x) => x.uid && x.d <= COLOCATION_RADIUS_M);
      const nearUsers = new Set(near.map((x) => x.uid));
      if (nearUsers.size > 0) {
         coloc = { count: nearUsers.size, minD: Math.round(Math.min(...near.map((x) => x.d))) };
         reasons.push(`📍 Applied within ${coloc.minD}m of ${coloc.count} other account${coloc.count > 1 ? 's' : ''}`);
      }
   }

   if (reasons.length > 0) {
      const { data: profile } = await supabase
         .from('users')
         .select('username, email')
         .eq('id', userId)
         .maybeSingle();
      const username = profile?.username ?? null;
      const email = profile?.email ?? null;
      const loanAmount = loan.loan_amount != null ? Number(loan.loan_amount) : null;
      const trackingId = (loan.tracking_id as string | null) ?? null;

      // (a) Admin Fraud Alert Queue — one row per loan per signal type. The
      //     unique(signal_type, subject_key) constraint keeps this idempotent
      //     if the same application is recorded twice.
      const alertRows: Record<string, unknown>[] = [];
      if (deviceOthers > 0) {
         alertRows.push({
            signal_type: 'shared_device',
            subject_key: loanId,
            details: { loan_id: loanId, tracking_id: trackingId, username, email, other_accounts: deviceOthers, loan_amount: loanAmount }
         });
      }
      if (coloc) {
         alertRows.push({
            signal_type: 'application_colocation',
            subject_key: loanId,
            details: { loan_id: loanId, tracking_id: trackingId, username, email, other_accounts: coloc.count, distance_m: coloc.minD, loan_amount: loanAmount }
         });
      }
      if (alertRows.length > 0) {
         await supabase
            .from('fraud_signal_alerts')
            .upsert(alertRows, { onConflict: 'signal_type,subject_key', ignoreDuplicates: true });
      }

      // (b) Discord alert for immediate visibility.
      await postFraudAlert({ username, email, loanAmount, trackingId, reasons });
   }

   return new Response(JSON.stringify({ ok: true, flagged: reasons.length > 0 }), {
      status: 200,
      headers: corsHeaders
   });
});
