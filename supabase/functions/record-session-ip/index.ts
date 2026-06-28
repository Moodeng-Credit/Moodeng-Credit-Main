import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// We never store a raw IP. This is a one-way salted hash used only to spot a
// borrower and a lender on the same loan signing in from the same place.
const hashIp = async (ip: string, salt: string) => {
   const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`));
   return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
};

const HOSTING_ASN_PATTERNS = [
   'amazon', 'aws', 'google cloud', 'google llc', 'microsoft', 'azure',
   'digitalocean', 'ovh', 'hetzner', 'linode', 'akamai connected cloud',
   'vultr', 'cloudflare', 'oracle', 'alibaba', 'tencent cloud',
   'choopa', 'contabo', 'hostinger', 'ionos', 'kamatera',
   'scaleway', 'upcloud', 'hostwinds', 'liquidweb'
];

const isHostingAsn = (orgName: string | undefined): boolean => {
   if (!orgName) return false;
   const lower = orgName.toLowerCase();
   return HOSTING_ASN_PATTERNS.some((p) => lower.includes(p));
};

type GeoResult = {
   country_iso: string | null;
   city_name: string | null;
   latitude: number | null;
   longitude: number | null;
   asn_number: number | null;
   asn_org: string | null;
   is_hosting: boolean;
};

const lookupGeo = async (ip: string): Promise<GeoResult | null> => {
   const accountId = Deno.env.get('MAXMIND_ACCOUNT_ID');
   const licenseKey = Deno.env.get('MAXMIND_LICENSE_KEY');
   if (!accountId || !licenseKey) return null;

   try {
      const res = await fetch(`https://geolite.info/geoip/v2.1/city/${ip}`, {
         headers: {
            Authorization: 'Basic ' + btoa(`${accountId}:${licenseKey}`)
         }
      });
      if (!res.ok) return null;

      const data = await res.json();
      const asnOrg: string | undefined = data.traits?.autonomous_system_organization;

      return {
         country_iso: data.country?.iso_code ?? null,
         city_name: data.city?.names?.en ?? null,
         latitude: data.location?.latitude ?? null,
         longitude: data.location?.longitude ?? null,
         asn_number: data.traits?.autonomous_system_number ?? null,
         asn_org: asnOrg ?? null,
         is_hosting: isHostingAsn(asnOrg)
      };
   } catch {
      return null;
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
   // Fail safe: if no salt is configured, do nothing rather than store a weak hash.
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

   // Supabase/edge proxies put the real client IP first in x-forwarded-for.
   const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
   if (!ip) {
      return new Response(JSON.stringify({ ok: false, skipped: 'no-ip' }), { status: 200, headers: corsHeaders });
   }

   // Query GeoLite2 BEFORE hashing — we need the raw IP for the lookup.
   // If MaxMind is down or unconfigured, we still record the hash.
   const geo = await lookupGeo(ip);

   const ipHash = await hashIp(ip, salt);
   const today = new Date().toISOString().slice(0, 10);

   const row: Record<string, unknown> = {
      user_id: userId,
      ip_hash: ipHash,
      seen_on: today,
      last_seen_at: new Date().toISOString()
   };

   if (geo) {
      row.country_iso = geo.country_iso;
      row.city_name = geo.city_name;
      row.latitude = geo.latitude;
      row.longitude = geo.longitude;
      row.asn_number = geo.asn_number;
      row.asn_org = geo.asn_org;
      row.is_hosting = geo.is_hosting;
   }

   const { error } = await supabase.from('auth_ip_log').upsert(row, { onConflict: 'user_id,ip_hash,seen_on' });

   if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 200, headers: corsHeaders });
   }

   return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
});
