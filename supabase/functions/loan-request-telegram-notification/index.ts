import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { adminUserUrl } from '../_shared/adminCards.ts';
import { postDiscord } from '../_shared/discord.ts';
import { buildTelegramLoanRequestMessage } from '../_shared/telegramLoanNotifications.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';
import { sendIdTelegram } from '../_shared/idTrack.ts';

const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
   'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

type SupabaseClient = ReturnType<typeof createClient<any>>;

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

const INCOME_DOCS_URL = 'https://moodeng.app/admin/income-docs';

type IncomeDoc = { status: string; verdict: string | null; decision: string | null; files: unknown[] | null; created_at: string };

// The team's view of the borrower's proof of income, for the admin copy only (lenders never see it):
// "📄 Income proof: 5 files · ⚠️ needs review (AI couldn't read) · today". Null when we couldn't look.
const incomeProofLine = async (supabase: SupabaseClient, userId: string): Promise<{ line: string; doc: boolean } | null> => {
   const { data, error } = await supabase
      .from('income_documents')
      .select('status, verdict, decision, files, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
   if (error) {
      console.error('loan-request: income proof lookup failed:', error.message);
      return null;
   }
   const doc = (data?.[0] ?? null) as IncomeDoc | null;
   if (!doc) return { line: '📄 Income proof: none', doc: false };
   const count = Array.isArray(doc.files) ? doc.files.length : 0;
   const state =
      doc.decision === 'approved'
         ? '✅ approved'
         : doc.decision === 'declined'
           ? '❌ declined'
           : doc.status === 'pending' || doc.status === 'processing'
             ? '⏳ AI still checking'
             : doc.verdict === 'looks_good'
               ? '👍 AI: looks good'
               : doc.verdict === 'resend'
                 ? '🔁 asked to send again'
                 : doc.status === 'failed'
                   ? "⚠️ needs review (AI couldn't read)"
                   : '⚠️ needs review';
   const days = Math.floor((Date.now() - new Date(doc.created_at).getTime()) / 86400000);
   const when = days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days}d ago`;
   return { line: `📄 Income proof: ${count} file${count === 1 ? '' : 's'} · ${state} · ${when}`, doc: true };
};

const buildLoanUrl = (loanId: string) => {
   const siteUrl = Deno.env.get('VITE_SITE_URL') ?? Deno.env.get('MOODENG_APP_URL') ?? Deno.env.get('SITE_URL') ?? 'https://moodeng.app';
   return `${siteUrl.replace(/\/$/, '')}/request-board?highlight=${loanId}`;
};

serve(async (req) => {
   if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
   }

   if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
   }

   const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
   const authorization = await authorizeInternalRequest(supabase, req);
   if (!authorization.authorized) {
      return new Response(JSON.stringify({ error: authorization.error }), {
         status: authorization.status,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
   }

   try {
      const { loanId, dryRun = false, mock = false } = await req.json().catch(() => ({}));

      if (mock) {
         const mockLoan = {
            id: 'mock-loan-id',
            tracking_id: 'MOCK-001',
            loan_amount: 20,
            coin: 'USDC',
            due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString(),
            reason: 'Groceries and transport for the week',
            borrower_user_id: 'mock-borrower',
            loan_status: 'Requested'
         };
         const mockBorrower = { username: 'alex_borrower', mal: 3 };
         const mockHistory = [
            {
               id: 'prev-loan-1',
               loan_amount: 15,
               created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
               funded_at: new Date(Date.now() - 44 * 24 * 60 * 60 * 1000).toISOString(),
               updated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
               loan_status: 'Lent',
               repayment_status: 'Paid',
               lender_user_id: 'lender-a',
               is_deleted: false
            },
            {
               id: 'prev-loan-2',
               loan_amount: 20,
               created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
               funded_at: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString(),
               updated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
               loan_status: 'Lent',
               repayment_status: 'Paid',
               lender_user_id: 'lender-b',
               is_deleted: false
            }
         ];
         const mockUrl = buildLoanUrl('mock-loan-id');
         const message = buildTelegramLoanRequestMessage(mockLoan, mockHistory, mockBorrower, mockUrl);
         return new Response(JSON.stringify({ message, loanUrl: mockUrl }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      if (!loanId) {
         return new Response(JSON.stringify({ error: 'loanId is required' }), { status: 400, headers: corsHeaders });
      }

      const { data: loan, error: loanError } = await supabase
         .from('loans')
         .select('id, tracking_id, loan_amount, coin, due_date, created_at, reason, borrower_user_id, loan_status, on_hold_since, on_hold_reason, market')
         .eq('id', loanId)
         .maybeSingle();

      if (loanError) throw new Error(loanError.message);
      if (!loan) {
         return new Response(JSON.stringify({ error: 'Loan not found' }), { status: 404, headers: corsHeaders });
      }

      if (loan.loan_status !== 'Requested') {
         return new Response(JSON.stringify({ message: 'Loan is not an active request.' }), { status: 200, headers: corsHeaders });
      }

      const { data: borrower } = loan.borrower_user_id
         ? await supabase.from('users').select('username, mal').eq('id', loan.borrower_user_id).maybeSingle()
         : { data: null };

      const { data: history, error: historyError } = loan.borrower_user_id
         ? await supabase
              .from('loans')
              .select('id, loan_amount, created_at, funded_at, updated_at, loan_status, repayment_status, lender_user_id')
              .eq('borrower_user_id', loan.borrower_user_id)
              .order('created_at', { ascending: true })
         : { data: [], error: null };

      if (historyError) throw new Error(historyError.message);

      const loanUrl = buildLoanUrl(loan.id);
      // A request on hold isn't shown to lenders yet: tell the team why, and don't broadcast it.
      const holdNote =
         loan.on_hold_since && loan.on_hold_reason === 'awaiting_call'
            ? '⏸ On hold until their video call: not shown to lenders. It goes live (and lenders are pinged) when you tap ✅ Showed up.\n\n'
            : loan.on_hold_since
              ? '⏸ On hold (missed their video call): not shown to lenders until they book a new call.\n\n'
              : '';
      const message = holdNote + buildTelegramLoanRequestMessage(loan, history ?? [], borrower, loanUrl);
      // Admin copy (team Telegram + Discord) also says what proof of income they sent; the lender copy doesn't.
      const income = loan.borrower_user_id ? await incomeProofLine(supabase, loan.borrower_user_id).catch(() => null) : null;
      const adminMessage = income ? `${income.line}\n\n${message}` : message;

      if (dryRun) {
         return new Response(JSON.stringify({ message, adminMessage, loanUrl }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      // 1) Admin fan-out — fires on EVERY new request, independent of the public lender broadcast
      //    toggle: the admins-only Telegram channel (kyc_alert_chat_id) and the team Discord channel.
      //    Both are best-effort so neither can block the other or the lender broadcast below.
      const adminChatId = await getSetting(supabase, 'kyc_alert_chat_id');
      if (adminChatId) {
         await sendTelegramMessage(adminChatId, adminMessage, {
            inlineKeyboard: [[{ text: 'View request', url: loanUrl }, ...(income?.doc ? [{ text: '📄 Income proof', url: INCOME_DOCS_URL }] : [])]]
         }).catch((err) => console.error('loan-request admin Telegram failed:', err instanceof Error ? err.message : err));
      }
      await postDiscord(
         {
            embeds: [
               {
                  title: loan.market === 'ID' ? '🇮🇩 New loan request · Indonesia' : '💸 New loan request',
                  description: income?.doc ? `${adminMessage}\n[📄 Income proof](${INCOME_DOCS_URL})` : adminMessage,
                  // Title links to the borrower in the admin panel (👤 Open in admin).
                  ...(loan.borrower_user_id ? { url: adminUserUrl(loan.borrower_user_id, borrower?.username) } : {}),
                  color: 0x5865f2,
                  timestamp: new Date().toISOString()
               }
            ]
         },
         // Remembered: edited to FUNDED / OVERDUE / REPAID / DELETED / EXPIRED (state-events-dispatch).
         { prefer: ['DISCORD_REQUESTS_WEBHOOK_URL'], ref: { svc: supabase, kind: 'loan', refId: loan.id } }
      );

      // Indonesia track: tell the borrower on Telegram that their request is up (Bahasa). A request on
      // hold isn't visible to lenders yet, so not then.
      if (loan.market === 'ID' && loan.borrower_user_id && !holdNote) {
         await sendIdTelegram(supabase, loan.borrower_user_id, 'loan_posted', { amount: loan.loan_amount });
      }

      if (holdNote) {
         return new Response(JSON.stringify({ message: 'Team notified; request is on hold, so no lender broadcast' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      // 2) Public lender-group broadcast — only when explicitly enabled.
      const enabled = (await getSetting(supabase, 'lender_notifications_enabled')) === 'true';
      if (!enabled) {
         return new Response(JSON.stringify({ message: 'Admin + Discord notified; lender broadcast disabled.' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      const chatId =
         (await getSetting(supabase, 'lender_group_chat_id')) ??
         Deno.env.get('TELEGRAM_LENDER_GROUP_CHAT_ID') ??
         Deno.env.get('STAGING_TELEGRAM_LENDER_GROUP_CHAT_ID');

      if (!chatId) {
         throw new Error('lender_group_chat_id is not configured.');
      }

      await sendTelegramMessage(chatId, message, {
         inlineKeyboard: [[{ text: 'Fund this loan', url: loanUrl }]]
      });

      return new Response(JSON.stringify({ message: 'Telegram lender notification sent' }), {
         status: 200,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
   } catch (error) {
      console.error('loan-request-telegram-notification failed:', error instanceof Error ? error.message : error);
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Telegram lender notification failed' }), {
         status: 500,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
   }
});
