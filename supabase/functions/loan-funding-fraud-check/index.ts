// Phase 4a — real-time self-lending check, invoked by the loans funding trigger.
// Runs the targeted overlap RPC for one loan and, on a new finding, dispatches a
// critical alert through the unified security dispatcher (Phase 3).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { deliverSecurityAlert } from '../_shared/securityAlerts.ts';
import { buildFundingAlert, FundingOverlap } from '../_shared/fundingOverlap.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }
   if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
   }

   const body = await req.json().catch(() => ({}));
   const loanId = body.loanId ?? body.loan_id;
   if (!loanId) {
      return new Response(JSON.stringify({ error: 'loanId is required' }), { status: 400, headers: corsHeaders });
   }

   const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
   );

   const { data, error } = await supabase.rpc('check_loan_funding_overlap', { p_loan_id: loanId });
   if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
   }

   // null => not funded / both whitelisted / no overlap / already alerted.
   if (!data) {
      return new Response(JSON.stringify({ flagged: false }), { status: 200, headers: corsHeaders });
   }

   const overlap = data as FundingOverlap;
   const { title, body: alertBody } = buildFundingAlert(overlap);

   const delivery = await deliverSecurityAlert(supabase, {
      source: 'realtime',
      severity: 'critical',
      title,
      body: alertBody
   });

   return new Response(JSON.stringify({ flagged: true, overlaps: overlap.overlaps, delivery }), {
      status: 200,
      headers: corsHeaders
   });
});
