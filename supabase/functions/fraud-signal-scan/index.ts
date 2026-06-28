import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendEmail } from '../_shared/email.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const ALERT_EMAIL = Deno.env.get('FRAUD_ALERT_EMAIL') ?? 'georgemlerner@gmail.com';

type Signal = {
   type: string;
   severity: string;
   wallet_address?: string;
   account_count?: number;
   borrower_and_lender?: boolean;
   accounts?: Array<{ user_id: string; role: string; email: string; username: string }>;
   loan_id?: string;
   tracking_id?: string;
   wallet?: string;
   user_id?: string;
   username?: string;
   asn_org?: string;
   hosting_logins?: number;
   location_a?: string;
   location_b?: string;
   distance_km?: number;
   hours_apart?: number;
};

const describe = (s: Signal): string => {
   switch (s.type) {
      case 'shared_wallet':
         return `Same wallet on ${s.account_count} accounts${s.borrower_and_lender ? ' — INCLUDING a borrower AND a lender' : ''}\n  wallet: ${s.wallet_address}\n  accounts: ${(s.accounts ?? [])
            .map((a) => `${a.username ?? a.user_id} (${a.role}, ${a.email ?? 'no email'})`)
            .join('; ')}`;
      case 'self_deal_wallet':
         return `Self-deal — loan ${s.tracking_id ?? s.loan_id} has the same wallet on both sides\n  wallet: ${s.wallet}`;
      case 'counterparty_shared_wallet':
         return `Loan ${s.tracking_id ?? s.loan_id}: lender & borrower share a wallet in their history\n  wallet: ${s.wallet}`;
      case 'counterparty_shared_ip':
         return `Loan ${s.tracking_id ?? s.loan_id}: lender & borrower logged in from the same IP`;
      case 'datacenter_ip':
         return `${s.username ?? s.user_id} logged in from a datacenter/hosting IP (${s.asn_org}) — ${s.hosting_logins} time(s)`;
      case 'impossible_travel':
         return `${s.username ?? s.user_id} impossible travel: ${s.location_a} → ${s.location_b} (${s.distance_km} km in ${s.hours_apart} h)`;
      default:
         return `${s.type}: ${JSON.stringify(s)}`;
   }
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }
   if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
   }

   const body = await req.json().catch(() => ({}));
   const ipWindowDays = typeof body.ipWindowDays === 'number' ? body.ipWindowDays : 14;

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   const { data, error } = await supabase.rpc('scan_wallet_fraud_signals', { ip_window_days: ipWindowDays });
   if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
   }

   const signals = ((data?.signals ?? []) as Signal[]) ?? [];
   if (!signals.length) {
      return new Response(JSON.stringify({ message: 'No new fraud signals' }), { status: 200, headers: corsHeaders });
   }

   // Critical findings (borrower+lender sharing a wallet, self-deals, counterparty
   // overlap) lead; weaker IP-only signals follow.
   const critical = signals.filter((s) => s.severity === 'critical');
   const warnings = signals.filter((s) => s.severity !== 'critical');

   const lines: string[] = [];
   lines.push(`Moodeng fraud scan — ${signals.length} new signal(s).`);
   lines.push('');
   if (critical.length) {
      lines.push(`CRITICAL (${critical.length}):`);
      critical.forEach((s, i) => lines.push(`${i + 1}. ${describe(s)}`));
      lines.push('');
   }
   if (warnings.length) {
      lines.push(`Worth a look (${warnings.length}):`);
      warnings.forEach((s, i) => lines.push(`${i + 1}. ${describe(s)}`));
   }
   lines.push('');
   lines.push('These are detection signals, not proof — review before acting. Already-seen findings are suppressed, so each only emails once.');

   const text = lines.join('\n');
   const subject = `🚨 Moodeng fraud scan: ${critical.length} critical, ${warnings.length} to review`;

   await sendEmail(ALERT_EMAIL, subject, text);

   return new Response(JSON.stringify({ message: 'Fraud signals emailed', count: signals.length }), {
      status: 200,
      headers: corsHeaders
   });
});
