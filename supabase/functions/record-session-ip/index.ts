import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// We never store a raw IP. These are one-way salted hashes used only to spot a
// borrower and a lender on the same loan signing in from the same place.
const hashValue = async (value: string, salt: string) => {
   const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${value}`));
   return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
};

// Derive the network block an IP belongs to, so accounts that rotate IPs within
// the same block (the classic farm pattern) collide on a shared subnet hash even
// when no two full IPs match. IPv4 -> /24 (first 3 octets); IPv6 -> /48 (first 3
// hextets). Returns null if the IP doesn't parse, so we just skip the subnet hash.
const subnetKey = (ip: string): string | null => {
   if (ip.includes(':')) {
      // IPv6 (may be compressed). Expand to full groups, keep the first 3.
      const groups = ip.split('::');
      const head = groups[0].split(':').filter(Boolean);
      const tail = groups.length > 1 ? groups[1].split(':').filter(Boolean) : [];
      const missing = 8 - head.length - tail.length;
      const full = [...head, ...Array(Math.max(missing, 0)).fill('0'), ...tail];
      if (full.length < 3) return null;
      return full.slice(0, 3).map((h) => h.padStart(4, '0')).join(':') + '::/48';
   }
   const octets = ip.split('.');
   if (octets.length !== 4 || octets.some((o) => o === '' || Number.isNaN(Number(o)))) return null;
   return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
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

// Post a single login line to the #login-feed Discord channel. Fire-and-forget:
// any failure here must never affect the session-recording response. Red embed
// when the login trips a flag (datacenter/VPN IP, or a subnet shared with other
// accounts), green when it looks clean — so weird logins stand out at a glance.
const postLoginFeed = async (details: {
   username: string | null;
   email: string | null;
   geo: GeoResult | null;
   sharedSubnetUsers: number;
}) => {
   const webhook = Deno.env.get('DISCORD_LOGIN_WEBHOOK_URL');
   if (!webhook) return;

   const { username, email, geo, sharedSubnetUsers } = details;

   const flags: string[] = [];
   if (geo?.is_hosting) flags.push('🚩 Datacenter / VPN IP');
   if (sharedSubnetUsers > 0) {
      flags.push(`🚩 Shared subnet with ${sharedSubnetUsers} other account${sharedSubnetUsers > 1 ? 's' : ''}`);
   }
   const flagged = flags.length > 0;

   const location = geo
      ? `${geo.city_name ?? 'Unknown city'}, ${geo.country_iso ?? '??'}`
      : 'Unknown (no geo)';
   const network = geo?.asn_org
      ? `${geo.asn_org}${geo.asn_number ? ` (AS${geo.asn_number})` : ''}`
      : 'Unknown';

   const embed = {
      title: `🔐 Login — ${username ?? 'unknown user'}`,
      color: flagged ? 0xe74c3c : 0x2ecc71,
      fields: [
         { name: 'User', value: `${username ?? '—'}\n${email ?? '—'}`, inline: true },
         { name: 'Location', value: location, inline: true },
         { name: 'Network', value: network, inline: true },
         { name: 'Flags', value: flags.length ? flags.join('\n') : '✅ none', inline: false }
      ],
      timestamp: new Date().toISOString()
   };

   try {
      await fetch(webhook, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ embeds: [embed] })
      });
   } catch {
      // Swallow — the login feed is best-effort and must not break session logging.
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

   const ipHash = await hashValue(ip, salt);
   // Salted hash of the IP's /24 (or IPv6 /48) block — lets us spot accounts
   // rotating IPs within the same subnet without ever storing a raw IP.
   const subnet = subnetKey(ip);
   const subnetHash = subnet ? await hashValue(subnet, salt) : null;
   const today = new Date().toISOString().slice(0, 10);

   // Is this the first time we've seen this user on this IP today? We use that to
   // post exactly one login-feed line per user per IP per day — so the channel
   // shows each person once, and a mid-day network switch shows up as a new line.
   const { data: existing } = await supabase
      .from('auth_ip_log')
      .select('user_id')
      .eq('user_id', userId)
      .eq('ip_hash', ipHash)
      .eq('seen_on', today)
      .maybeSingle();
   const isNewLoginToday = !existing;

   const row: Record<string, unknown> = {
      user_id: userId,
      ip_hash: ipHash,
      subnet_hash: subnetHash,
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

   // Best-effort login feed. Only on the first sighting per user/IP/day so we
   // don't spam the channel on every throttled profile refresh.
   if (isNewLoginToday) {
      // Who is this? Pull the display fields for the Discord line.
      const { data: profile } = await supabase
         .from('users')
         .select('username, email')
         .eq('id', userId)
         .maybeSingle();

      // How many OTHER accounts have logged in from this same /24 (or /48)? A
      // non-zero count is the classic shared-network signal worth eyeballing.
      let sharedSubnetUsers = 0;
      if (subnetHash) {
         const { data: subnetRows } = await supabase
            .from('auth_ip_log')
            .select('user_id')
            .eq('subnet_hash', subnetHash)
            .neq('user_id', userId);
         sharedSubnetUsers = new Set((subnetRows ?? []).map((r) => r.user_id)).size;
      }

      await postLoginFeed({
         username: profile?.username ?? null,
         email: profile?.email ?? null,
         geo,
         sharedSubnetUsers
      });
   }

   return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
});
