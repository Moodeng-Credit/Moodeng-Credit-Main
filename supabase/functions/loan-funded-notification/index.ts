import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendEmail } from '../_shared/email.ts';
import { buildLoanNotificationEmail, LoanNotificationType } from '../_shared/loanNotifications.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const hasNotificationBeenSent = async (
   supabase: ReturnType<typeof createClient>,
   payload: { loanId: string; userId: string; type: LoanNotificationType }
) => {
   const { data } = await supabase
      .from('loan_notifications')
      .select('id')
      .eq('loan_id', payload.loanId)
      .eq('user_id', payload.userId)
      .eq('notification_type', payload.type)
      .maybeSingle();

   return Boolean(data);
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }

   if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
   }

   const { loanId } = await req.json().catch(() => ({}));

   if (!loanId) {
      return new Response(JSON.stringify({ error: 'loanId is required' }), { status: 400, headers: corsHeaders });
   }

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

   const { data: loan, error: loanError } = await supabase
      .from('loans')
      .select('id, tracking_id, borrower_user, loan_amount, total_repayment_amount, due_date, funded_at, lender_user')
      .eq('id', loanId)
      .maybeSingle();

   if (loanError) {
      return new Response(JSON.stringify({ error: loanError.message }), { status: 500, headers: corsHeaders });
   }

   if (!loan) {
      return new Response(JSON.stringify({ error: 'Loan not found' }), { status: 404, headers: corsHeaders });
   }

   if (!loan.borrower_user) {
      return new Response(JSON.stringify({ error: 'Loan borrower is missing' }), { status: 400, headers: corsHeaders });
   }

   const { data: borrower, error: borrowerError } = await supabase
      .from('users')
      .select('id, username, email')
      .eq('id', loan.borrower_user)
      .maybeSingle();

   if (borrowerError) {
      return new Response(JSON.stringify({ error: borrowerError.message }), { status: 500, headers: corsHeaders });
   }

   if (!borrower?.email) {
      return new Response(JSON.stringify({ error: 'Borrower email not found' }), { status: 404, headers: corsHeaders });
   }

   const { data: lender } = loan.lender_user
      ? await supabase.from('users').select('username').eq('id', loan.lender_user).maybeSingle()
      : { data: null };

   const loanPayload = {
      ...loan,
      lender_username: lender?.username ?? null
   };

   const alreadySent = await hasNotificationBeenSent(supabase, { loanId: loan.id, userId: borrower.id, type: 'funded' });

   if (alreadySent) {
      return new Response(JSON.stringify({ message: 'Notification already sent' }), { status: 200, headers: corsHeaders });
   }

   const { subject, text } = buildLoanNotificationEmail('funded', loanPayload, borrower);

   await sendEmail(borrower.email, subject, text);

   const { error: insertError } = await supabase.from('loan_notifications').insert({
      loan_id: loan.id,
      user_id: borrower.id,
      notification_type: 'funded'
   });

   if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: corsHeaders });
   }

   return new Response(JSON.stringify({ message: 'Notification sent' }), { status: 200, headers: corsHeaders });
});
