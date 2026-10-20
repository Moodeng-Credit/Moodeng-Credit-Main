'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// Admin → More → Test lab: a place to try things for real before people do. Tools: a Stableyard
// credential check, and Semaphore SMS. SMS goes through admin_semaphore_call / admin_semaphore_result
// (supabase/migrations/20261019120000_admin_sms_test_lab.sql), which call Semaphore with the Vault key
// via pg_net, so the reply is fetched a moment after the request.

type SemaphoreResult = { done: boolean; http_status?: number; error?: string | null; body?: unknown };

type SemaphoreMessage = {
   message_id: number;
   recipient: string;
   message: string;
   sender_name: string;
   network: string;
   status: string;
   code?: number;
   created_at: string;
};

type SenderName = { name: string; status: string };
type Account = { status: string; credit_balance: number };
type HookRow = { status: string; failure_reason: string | null; created_at: string };

type Route = 'send' | 'priority' | 'otp';

const ROUTES: Array<{ id: Route; label: string; note: string }> = [
   { id: 'otp', label: 'OTP route', note: '2 credits. Put {otp} where the code goes; Semaphore makes a 6-digit code.' },
   { id: 'priority', label: 'Priority', note: '2 credits. Skips the queue. This is what sign-in codes use.' },
   { id: 'send', label: 'Regular', note: '1 credit. Can be slow when networks are busy.' }
];

const DEFAULT_MESSAGE: Record<Route, string> = {
   otp: 'Your Moodeng code is {otp}. Don’t share it with anyone.',
   priority: 'Hi from Moodeng! This is a delivery check, reply not needed.',
   send: 'Hi from Moodeng! This is a delivery check, reply not needed.'
};

const STATUS_HELP: Record<string, string> = {
   Queued: 'Waiting at Semaphore.',
   Pending: 'On its way to the network.',
   Sent: 'The network accepted it. Ask the person if it arrived.',
   Failed: 'The network refused it. Credits come back.',
   Refunded: 'Failed and the credits came back.'
};

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const bangkokTime = (iso: string) =>
   new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Semaphore stamps times in Manila time (UTC+8) with no zone; show them in Bangkok time like the rest.
const semaphoreTime = (value: string) => {
   const parsed = new Date(`${value.replace(' ', 'T')}+08:00`);
   return Number.isNaN(parsed.getTime()) ? value : bangkokTime(parsed.toISOString());
};

const asArray = <T,>(body: unknown): T[] => (Array.isArray(body) ? (body as T[]) : body && typeof body === 'object' ? [body as T] : []);

/** Ask Semaphore something via the database and wait (up to ~20s) for its reply. */
async function semaphore(
   kind: string,
   args: { p_number?: string; p_message?: string; p_sender?: string | null; p_message_id?: number } = {}
): Promise<SemaphoreResult> {
   const supabase = getSupabaseBrowserClient();
   const { data: requestId, error } = await supabase.rpc('admin_semaphore_call', { p_kind: kind, ...args });
   if (error) throw new Error(error.message);
   for (let i = 0; i < 30; i += 1) {
      await sleep(i === 0 ? 400 : 700);
      const { data, error: resultError } = await supabase.rpc('admin_semaphore_result', { p_request_id: requestId });
      if (resultError) throw new Error(resultError.message);
      const result = data as SemaphoreResult;
      if (result.done) return result;
   }
   throw new Error('Semaphore did not answer within 20 seconds. Check Recent texts in a minute.');
}

const describeError = (result: SemaphoreResult) => {
   if (result.error) return result.error;
   const body = result.body;
   if (typeof body === 'string') return body;
   if (body && typeof body === 'object') {
      const values = Object.values(body as Record<string, unknown>).flat();
      const text = values.filter((v) => typeof v === 'string').join(' ');
      if (text) return text;
      return JSON.stringify(body);
   }
   return `HTTP ${result.http_status}`;
};

const inputClass =
   'h-12 w-full rounded-xl border border-[#2a1453] bg-[#12062a] px-3 text-base text-white outline-none placeholder:text-[#6b5a85] focus:border-[#a06bff]';
const cardClass = 'space-y-3 rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-4 sm:p-5';
const smallButton = 'rounded-lg border border-[#2a1453] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60';

type StableyardCheck = { ok: boolean; stableyardStatus?: number; error?: string; partner?: unknown; details?: unknown };

// Stableyard credential check (GET /v2/partners/me via the stableyard-partner-check function). A 200
// with the partner profile is what Stableyard asks to see before going live.
function StableyardCheckCard() {
   const [checking, setChecking] = useState(false);
   const [result, setResult] = useState<StableyardCheck | null>(null);

   const runCheck = async () => {
      setChecking(true);
      const { data, error } = await getSupabaseBrowserClient().functions.invoke('stableyard-partner-check', { body: {} });
      let next = data as StableyardCheck | null;
      if (error) {
         const context = (error as { context?: { json?: () => Promise<StableyardCheck> } }).context;
         next = (await context?.json?.().catch(() => null)) ?? { ok: false, error: error.message };
      }
      setResult(next ?? { ok: false, error: 'No response' });
      setChecking(false);
   };

   return (
      <div className={cardClass}>
         <div className="flex items-center justify-between gap-3">
            <p className="text-base font-bold text-white">Stableyard</p>
            <button type="button" onClick={() => void runCheck()} disabled={checking} className={smallButton}>
               {checking ? 'Checking…' : 'Check credentials'}
            </button>
         </div>
         {result ? (
            <>
               <p className={`text-sm font-semibold ${result.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                  {result.ok
                     ? `Connected (HTTP ${result.stableyardStatus}). Tell Stableyard GET /v2/partners/me works.`
                     : `Failed${result.stableyardStatus ? ` (HTTP ${result.stableyardStatus})` : ''}: ${result.error}`}
               </p>
               <pre className="max-h-64 overflow-auto rounded-xl border border-[#2a1453] p-3 text-xs text-[#a89bb8]">
                  {JSON.stringify(result.ok ? result.partner : (result.details ?? null), null, 2)}
               </pre>
            </>
         ) : (
            <p className="text-sm text-[#a89bb8]">Calls GET /v2/partners/me with the production credentials.</p>
         )}
      </div>
   );
}

function StatusPill({ status }: { status: string }) {
   const tone =
      status === 'Sent' || status === 'Active' || status === 'sent'
         ? 'bg-emerald-500/15 text-emerald-300'
         : status === 'Failed' || status === 'Refunded' || status.startsWith('error') || status === 'failed'
           ? 'bg-red-500/15 text-red-300'
           : 'bg-amber-500/15 text-amber-200';
   return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{status}</span>;
}

export default function TestLabSection() {
   const [account, setAccount] = useState<Account | null>(null);
   const [senders, setSenders] = useState<SenderName[]>([]);
   const [statusError, setStatusError] = useState<string | null>(null);
   const [statusLoading, setStatusLoading] = useState(false);

   const [number, setNumber] = useState('');
   const [route, setRoute] = useState<Route>('otp');
   const [message, setMessage] = useState(DEFAULT_MESSAGE.otp);
   const [sender, setSender] = useState('');
   const [sending, setSending] = useState(false);
   const [sendError, setSendError] = useState<string | null>(null);
   const [sent, setSent] = useState<SemaphoreMessage | null>(null);
   const [checking, setChecking] = useState(false);

   const [recent, setRecent] = useState<SemaphoreMessage[]>([]);
   const [recentLoading, setRecentLoading] = useState(false);
   const [hookLog, setHookLog] = useState<HookRow[]>([]);

   const loadStatus = useCallback(async () => {
      setStatusLoading(true);
      setStatusError(null);
      try {
         const [acct, names] = await Promise.all([semaphore('account'), semaphore('sendernames')]);
         if (acct.http_status === 200) setAccount(acct.body as Account);
         else setStatusError(describeError(acct));
         if (names.http_status === 200) setSenders(asArray<SenderName>(names.body));
      } catch (err) {
         setStatusError(err instanceof Error ? err.message : 'Could not reach Semaphore');
      }
      setStatusLoading(false);
   }, []);

   const loadRecent = useCallback(async () => {
      setRecentLoading(true);
      try {
         const result = await semaphore('messages');
         if (result.http_status === 200) setRecent(asArray<SemaphoreMessage>(result.body));
      } catch {
         // The status card already shows when Semaphore can't be reached.
      }
      const { data } = await getSupabaseBrowserClient().rpc('admin_sms_hook_log');
      setHookLog((data ?? []) as HookRow[]);
      setRecentLoading(false);
   }, []);

   useEffect(() => {
      void loadStatus();
      void loadRecent();
   }, [loadStatus, loadRecent]);

   const pickRoute = (next: Route) => {
      // Swap the sample text only if it's still a sample.
      if (Object.values(DEFAULT_MESSAGE).includes(message)) setMessage(DEFAULT_MESSAGE[next]);
      setRoute(next);
   };

   const send = async (e: FormEvent) => {
      e.preventDefault();
      setSendError(null);
      setSent(null);
      if (/^\s*test/i.test(message)) {
         setSendError('Semaphore silently drops messages that start with "TEST". Start with something else.');
         return;
      }
      setSending(true);
      try {
         const result = await semaphore(route, { p_number: number, p_message: message, p_sender: sender || null });
         const first = asArray<SemaphoreMessage>(result.body)[0];
         if (result.http_status === 200 && first?.message_id) {
            setSent(first);
            void loadRecent();
            void loadStatus();
         } else {
            setSendError(`Semaphore said no (HTTP ${result.http_status}): ${describeError(result)}`);
         }
      } catch (err) {
         setSendError(err instanceof Error ? err.message : 'Send failed');
      }
      setSending(false);
   };

   const recheck = async () => {
      if (!sent) return;
      setChecking(true);
      try {
         const result = await semaphore('message', { p_message_id: sent.message_id });
         const latest = asArray<SemaphoreMessage>(result.body)[0];
         if (latest) setSent({ ...sent, ...latest });
      } catch (err) {
         setSendError(err instanceof Error ? err.message : 'Could not check');
      }
      setChecking(false);
   };

   const approvedSenders = senders.filter((s) => s.status === 'Active');
   const routeNote = ROUTES.find((r) => r.id === route)?.note;

   return (
      <div className="space-y-6">
         <StableyardCheckCard />
         <div className={cardClass}>
            <div className="flex items-center justify-between gap-3">
               <p className="text-base font-bold text-white">Semaphore account</p>
               <button type="button" onClick={() => void loadStatus()} disabled={statusLoading} className={smallButton}>
                  {statusLoading ? 'Checking…' : 'Refresh'}
               </button>
            </div>
            {statusError ? <p className="text-sm font-semibold text-red-300">{statusError}</p> : null}
            <div className="grid gap-3 sm:grid-cols-3">
               <div className="rounded-xl border border-[#2a1453] p-3">
                  <p className="text-xs uppercase tracking-wide text-[#a89bb8]">Credits</p>
                  <p className="mt-1 text-2xl font-black text-white">{account ? account.credit_balance : '—'}</p>
               </div>
               <div className="rounded-xl border border-[#2a1453] p-3">
                  <p className="text-xs uppercase tracking-wide text-[#a89bb8]">Account</p>
                  <p className="mt-1.5">{account ? <StatusPill status={account.status} /> : '—'}</p>
               </div>
               <div className="rounded-xl border border-[#2a1453] p-3">
                  <p className="text-xs uppercase tracking-wide text-[#a89bb8]">Sender names</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                     {senders.length === 0 ? <span className="text-sm text-[#a89bb8]">—</span> : null}
                     {senders.map((s) => (
                        <span key={s.name} className="flex items-center gap-1.5 text-sm font-semibold text-white">
                           {s.name} <StatusPill status={s.status} />
                        </span>
                     ))}
                  </div>
               </div>
            </div>
            {senders.length > 0 && approvedSenders.length === 0 ? (
               <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-100">
                  No sender name is approved yet, so Semaphore refuses every text (HTTP 500) and sign-in codes are switched off. Once one
                  shows <b>Active</b>, send yourself a text here, then store its name in Vault as SEMAPHORE_SENDER_NAME to turn sign-in
                  codes on.
               </p>
            ) : null}
         </div>

         <form onSubmit={send} className={cardClass}>
            <p className="text-base font-bold text-white">Send a test text</p>
            <p className="text-sm text-[#a89bb8]">
               Philippine mobiles only. Ask someone in the Philippines to tell you when it arrives. Max 30 test texts a day.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
               <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#a89bb8]">Phone number *</span>
                  <input
                     value={number}
                     onChange={(e) => setNumber(e.target.value)}
                     placeholder="0917 123 4567"
                     inputMode="tel"
                     className={inputClass}
                  />
               </label>
               <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#a89bb8]">Sender name</span>
                  <select value={sender} onChange={(e) => setSender(e.target.value)} className={inputClass}>
                     <option value="">Default (Vault, else account default)</option>
                     {senders.map((s) => (
                        <option key={s.name} value={s.name}>
                           {s.name} ({s.status})
                        </option>
                     ))}
                  </select>
               </label>
            </div>
            <div className="flex flex-wrap gap-2">
               {ROUTES.map((r) => (
                  <button
                     key={r.id}
                     type="button"
                     onClick={() => pickRoute(r.id)}
                     className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                        route === r.id ? 'border-[#a06bff] bg-[#a06bff]/20 text-white' : 'border-[#2a1453] text-[#a89bb8]'
                     }`}
                  >
                     {r.label}
                  </button>
               ))}
            </div>
            {routeNote ? <p className="text-xs text-[#a89bb8]">{routeNote}</p> : null}
            <label className="block space-y-1">
               <span className="text-xs font-semibold uppercase tracking-wide text-[#a89bb8]">Message ({message.length}/160 per text)</span>
               <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-[#2a1453] bg-[#12062a] p-3 text-base text-white outline-none focus:border-[#a06bff]"
               />
            </label>
            {sendError ? <p className="text-sm font-semibold text-red-300">{sendError}</p> : null}
            <button
               type="submit"
               disabled={sending || !number.trim()}
               className="rounded-xl bg-[#a06bff] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
               {sending ? 'Sending…' : 'Send text'}
            </button>

            {sent ? (
               <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-[#e8defa]">
                  <div className="flex flex-wrap items-center gap-2">
                     <span className="font-semibold text-white">Semaphore took it</span>
                     <StatusPill status={sent.status} />
                     <span className="text-[#a89bb8]">
                        #{sent.message_id} · {sent.network || 'network ?'} · from {sent.sender_name}
                     </span>
                  </div>
                  {sent.code ? (
                     <p>
                        Code sent: <b className="font-mono text-white">{sent.code}</b>. Ask them to read it back.
                     </p>
                  ) : null}
                  <p className="text-[#a89bb8]">{STATUS_HELP[sent.status] ?? ''}</p>
                  <button type="button" onClick={() => void recheck()} disabled={checking} className={smallButton}>
                     {checking ? 'Checking…' : 'Check delivery status'}
                  </button>
               </div>
            ) : null}
         </form>

         <div className={cardClass}>
            <div className="flex items-center justify-between gap-3">
               <p className="text-base font-bold text-white">Recent texts (from Semaphore)</p>
               <button type="button" onClick={() => void loadRecent()} disabled={recentLoading} className={smallButton}>
                  {recentLoading ? 'Loading…' : 'Refresh'}
               </button>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full min-w-[640px] text-sm">
                  <thead>
                     <tr className="text-left text-xs uppercase tracking-wide text-[#a89bb8]">
                        <th className="px-2 py-2 font-semibold">When</th>
                        <th className="px-2 py-2 font-semibold">To</th>
                        <th className="px-2 py-2 font-semibold">From</th>
                        <th className="px-2 py-2 font-semibold">Status</th>
                        <th className="px-2 py-2 font-semibold">Message</th>
                     </tr>
                  </thead>
                  <tbody>
                     {recent.map((m) => (
                        <tr key={m.message_id} className="border-t border-[#2a1453] text-[#e8defa]">
                           <td className="whitespace-nowrap px-2 py-2">{semaphoreTime(m.created_at)}</td>
                           <td className="whitespace-nowrap px-2 py-2">
                              {m.recipient}
                              <span className="block text-xs text-[#a89bb8]">{m.network}</span>
                           </td>
                           <td className="px-2 py-2">{m.sender_name}</td>
                           <td className="px-2 py-2">
                              <StatusPill status={m.status} />
                           </td>
                           <td className="max-w-[320px] truncate px-2 py-2 text-[#a89bb8]">{m.message}</td>
                        </tr>
                     ))}
                     {!recentLoading && recent.length === 0 ? (
                        <tr>
                           <td colSpan={5} className="px-2 py-6 text-center text-[#a89bb8]">
                              No texts have gone out yet.
                           </td>
                        </tr>
                     ) : null}
                  </tbody>
               </table>
            </div>
         </div>

         <div className={cardClass}>
            <p className="text-base font-bold text-white">Sign-in code attempts</p>
            <p className="text-sm text-[#a89bb8]">What happened each time someone asked for a code by text (no phone numbers kept).</p>
            <div className="space-y-1">
               {hookLog.map((row) => (
                  <div
                     key={`${row.created_at}-${row.status}`}
                     className="flex flex-wrap items-center gap-2 border-t border-[#2a1453] py-1.5 text-sm"
                  >
                     <span className="w-32 text-[#a89bb8]">{bangkokTime(row.created_at)}</span>
                     <StatusPill status={row.status} />
                     {row.failure_reason ? <span className="text-[#a89bb8]">{row.failure_reason}</span> : null}
                  </div>
               ))}
               {hookLog.length === 0 ? <p className="text-sm text-[#a89bb8]">No attempts yet.</p> : null}
            </div>
         </div>
      </div>
   );
}
