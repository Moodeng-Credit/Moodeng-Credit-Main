import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
   buildLenderSuggestionMessage,
   rankLenders,
   type LenderLoan,
   type LenderRow,
   type ProspectRow
} from '../_shared/lenderSuggestions.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type SupabaseClient = ReturnType<typeof createClient<any>>;

const json = (body: unknown, status = 200) =>
   new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const getSetting = async (supabase: SupabaseClient, key: string) => {
   const { data, error } = await supabase.from('telegram_bot_settings').select('value').eq('key', key).maybeSingle();
   if (error) throw new Error(error.message);
   return data?.value as string | undefined;
};

const getRequestSecret = (req: Request) => {
   const authorization = req.headers.get('Authorization') ?? '';
   const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : null;
   return bearerToken ?? req.headers.get('x-notification-secret');
};

// Mirrors loan-request-telegram-notification: accept the service key directly, or
// fall back to the DB-stored internal secret verifier.
const authorizeInternalRequest = async (supabase: SupabaseClient, req: Request) => {
   const requestSecret = getRequestSecret(req);
   if (!requestSecret) {
      return { authorized: false, status: 401, error: 'Unauthorized' };
   }

   const expectedSecret = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('TELEGRAM_NOTIFICATION_SECRET');
   if (expectedSecret && requestSecret === expectedSecret) {
      return { authorized: true, status: 200, error: null };
   }

   const { data, error } = await supabase.rpc('verify_internal_notification_secret', { candidate: requestSecret });
   if (error) {
      return { authorized: false, status: 500, error: error.message };
   }
   if (data !== true) {
      return { authorized: false, status: 401, error: 'Unauthorized' };
   }

   return { authorized: true, status: 200, error: null };
};

const getTeamChatId = async (supabase: SupabaseClient) =>
   (await getSetting(supabase, 'team_group_chat_id')) ?? Deno.env.get('TEAM_TELEGRAM_CHAT_ID');

const buildLoanUrl = (loanId: string) => {
   const siteUrl = Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('SITE_URL') ?? 'https://app.moodeng.credit';
   return `${siteUrl.replace(/\/$/, '')}/request-board?loan=${loanId}`;
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }
   if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
   }

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
   const authorization = await authorizeInternalRequest(supabase, req);
   if (!authorization.authorized) {
      return json({ error: authorization.error }, authorization.status);
   }

   try {
      const { loanId, dryRun = false, mock = false } = await req.json().catch(() => ({}));

      // Preview the exact message the team would receive without touching the DB or Telegram.
      if (mock) {
         const mockLoan = { id: 'mock', loan_amount: 20, coin: 'USDC', reason: 'Groceries for the week', borrower_user_id: 'b1' };
         const mockLenders: LenderRow[] = [
            { id: 'l1', username: 'jane', telegram_username: 'jane_tg', created_at: new Date().toISOString() },
            { id: 'l2', username: 'bob', line_id: 'bob123', created_at: new Date(Date.now() - 200 * 86400000).toISOString() },
            { id: 'l3', username: 'carla', email: 'carla@example.com', created_at: new Date(Date.now() - 400 * 86400000).toISOString() }
         ];
         const mockLoans: LenderLoan[] = [
            { lender_user_id: 'l2', borrower_user_id: 'b1', loan_amount: 18, funded_at: new Date(Date.now() - 5 * 86400000).toISOString(), loan_status: 'Lent', repayment_status: 'Paid' },
            { lender_user_id: 'l3', borrower_user_id: 'bX', loan_amount: 200, funded_at: new Date(Date.now() - 3 * 86400000).toISOString(), loan_status: 'Lent', repayment_status: 'Unpaid' }
         ];
         const mockProspects: ProspectRow[] = [{ id: 'p1', name: 'Maria', handle: '@maria_tg', note: 'referred by Emma' }];
         const message = buildLenderSuggestionMessage(mockLoan, 'alex', rankLenders(mockLoan, mockLenders, mockLoans), mockProspects);
         return json({ message });
      }

      if (!loanId) {
         return json({ error: 'loanId is required' }, 400);
      }

      const enabled = (await getSetting(supabase, 'lender_suggestions_enabled')) === 'true';
      if (!enabled && !dryRun) {
         return json({ message: 'Lender suggestions are disabled.' });
      }

      const { data: loan, error: loanError } = await supabase
         .from('loans')
         .select('id, loan_amount, coin, reason, borrower_user_id, loan_status')
         .eq('id', loanId)
         .maybeSingle();
      if (loanError) throw new Error(loanError.message);
      if (!loan) return json({ error: 'Loan not found' }, 404);
      if (loan.loan_status !== 'Requested') return json({ message: 'Loan is not an active request.' });

      const { data: borrower } = loan.borrower_user_id
         ? await supabase.from('users').select('username').eq('id', loan.borrower_user_id).maybeSingle()
         : { data: null };

      const { data: lenders, error: lendersError } = await supabase
         .from('users')
         .select('id, username, telegram_username, line_id, email, chat_id, created_at')
         .eq('user_role', 'lender');
      if (lendersError) throw new Error(lendersError.message);

      const lenderIds = (lenders ?? []).map((lender: LenderRow) => lender.id);
      const { data: lenderLoans, error: loansError } = lenderIds.length
         ? await supabase
              .from('loans')
              .select('lender_user_id, borrower_user_id, loan_amount, funded_at, loan_status, repayment_status')
              .in('lender_user_id', lenderIds)
         : { data: [], error: null };
      if (loansError) throw new Error(loansError.message);

      const { data: prospects, error: prospectsError } = await supabase
         .from('lender_prospects')
         .select('id, name, handle, note')
         .eq('is_active', true)
         .order('created_at', { ascending: false });
      if (prospectsError) throw new Error(prospectsError.message);

      const ranked = rankLenders(loan, (lenders ?? []) as LenderRow[], (lenderLoans ?? []) as LenderLoan[]);
      const message = buildLenderSuggestionMessage(loan, borrower?.username, ranked, (prospects ?? []) as ProspectRow[]);

      if (dryRun) {
         return json({ message });
      }

      const chatId = await getTeamChatId(supabase);
      if (!chatId) {
         throw new Error('team_group_chat_id / TEAM_TELEGRAM_CHAT_ID is not configured.');
      }

      await sendTelegramMessage(chatId, message, {
         inlineKeyboard: [[{ text: 'View request', url: buildLoanUrl(loan.id) }]]
      });

      return json({ message: 'Lender suggestions sent', suggested: ranked.length });
   } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Lender suggestions failed' }, 500);
   }
});
