import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
   new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
   });

serve(async (req) => {
   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

   try {
      const ip =
         req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
         req.headers.get('x-real-ip') ||
         '';

      if (!ip) return jsonResponse({ allowed: false, countryCode: null, error: 'no_ip' }, 400);

      const geoRes = await fetch(`https://ipwho.is/${ip}`);
      const geo = await geoRes.json();

      const countryCode: string = geo.country_code ?? '';
      const allowed = countryCode === 'PH';

      return jsonResponse({ allowed, countryCode });
   } catch (err) {
      console.error('check-geo error:', err);
      // Fail open — don't block users if the geo service itself is down
      return jsonResponse({ allowed: true, countryCode: null, error: 'geo_check_failed' });
   }
});
