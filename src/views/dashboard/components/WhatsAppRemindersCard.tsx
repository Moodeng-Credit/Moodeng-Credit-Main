import { useCallback, useEffect, useRef, useState } from 'react';

import posthog from 'posthog-js';

import { clarityEvent } from '@/lib/analytics/clarity';
import { buildWhatsAppVerifyLink, WHATSAPP_BUSINESS_NUMBER_DISPLAY } from '@/config/contactVerification';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { OptionCard } from '@/views/dashboard/components/connectKit';

// WhatsApp reminders, for borrowers whose phone can't show notifications: Facebook's in-app browser
// (no notifications at all), iPhone Safari without the Home Screen app, or notifications blocked or
// broken. One tap opens WhatsApp with "Verify my Moodeng account: MDNG-XXXXXX" already typed to our
// business number; they hit send, SendPulse's "Confirm WhatsApp" flow passes the code to
// sendpulse-messenger-verify, which stamps users.whatsapp_verified_at, and this card turns green.
//
// Facebook's browser doesn't always hand a wa.me link over to WhatsApp, so the card also shows the code
// with a Copy button and the number to send it to: switching apps by hand always works.
const track = (event: string, properties: Record<string, unknown>) => {
   try {
      posthog.capture(event, properties);
   } catch {
      // Analytics unavailable: the flow carries on.
   }
};

const POLL_MS = 3_000;

export default function WhatsAppRemindersCard({
   userId,
   source,
   verified,
   onVerified,
   required = false
}: {
   userId: string;
   source: string;
   verified: boolean;
   onVerified: () => void;
   // Loan request for a borrower only email reaches: the card blocks Continue, so it says so.
   required?: boolean;
}) {
   const [code, setCode] = useState<string | null>(null);
   const [starting, setStarting] = useState(false);
   const [error, setError] = useState('');
   const [copied, setCopied] = useState(false);
   const pollRef = useRef<number | null>(null);
   // Required (they can't be reached on WhatsApp today, e.g. they sent STOP): an old
   // whatsapp_verified_at doesn't count, only a new one stamped by this code.
   const staleVerifiedAtRef = useRef<string | null>(null);

   const stopPolling = () => {
      if (pollRef.current !== null) {
         window.clearInterval(pollRef.current);
         pollRef.current = null;
      }
   };
   useEffect(() => stopPolling, []);

   const check = useCallback(async () => {
      const { data } = await getSupabaseBrowserClient().from('users').select('whatsapp_verified_at').eq('id', userId).maybeSingle();
      if (data?.whatsapp_verified_at && data.whatsapp_verified_at !== staleVerifiedAtRef.current) {
         stopPolling();
         track('contact_whatsapp_reminders_on', { source });
         clarityEvent('whatsapp_connected');
         onVerified();
      }
   }, [userId, source, onVerified]);

   // Mobile browsers freeze timers while they're away in WhatsApp: re-check the moment they're back.
   useEffect(() => {
      if (!code || verified) return;
      const onVisible = () => {
         if (document.visibilityState === 'visible') void check();
      };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onVisible);
      return () => {
         document.removeEventListener('visibilitychange', onVisible);
         window.removeEventListener('focus', onVisible);
      };
   }, [code, verified, check]);

   const start = async () => {
      if (starting) return;
      setError('');
      setStarting(true);
      track('contact_whatsapp_reminders_tapped', { source });
      clarityEvent('tapped_connect_whatsapp');
      try {
         if (required && staleVerifiedAtRef.current === null) {
            const { data: row } = await getSupabaseBrowserClient().from('users').select('whatsapp_verified_at').eq('id', userId).maybeSingle();
            staleVerifiedAtRef.current = row?.whatsapp_verified_at ?? null;
         }
         const { data, error: rpcError } = await getSupabaseBrowserClient().rpc('start_whatsapp_verification');
         if (rpcError || !data) throw rpcError ?? new Error('No code returned');
         const newCode = String(data);
         // No automatic open: opened by the page after the code request, Facebook's browser shows the
         // api.whatsapp.com web page instead of the app (George, 2026-10-18). The panel's green button is
         // a real link they tap, which hands the message to WhatsApp.
         setCode(newCode);
         stopPolling();
         pollRef.current = window.setInterval(() => void check(), POLL_MS);
      } catch (err) {
         console.error('start WhatsApp reminders failed', err);
         track('contact_whatsapp_reminders_start_failed', { source });
         setError("Couldn't start. Try again in a moment.");
      } finally {
         setStarting(false);
      }
   };

   const copyCode = async () => {
      if (!code) return;
      try {
         await navigator.clipboard.writeText(code);
         setCopied(true);
         track('contact_whatsapp_reminders_code_copied', { source });
         window.setTimeout(() => setCopied(false), 2000);
      } catch {
         // Clipboard blocked: the code is on screen to type by hand.
      }
   };

   if (verified) {
      return (
         <OptionCard
            done
            doneLabel="On"
            icon={<i aria-hidden="true" className="fab fa-whatsapp text-[38px] leading-none text-[#25D366]" />}
            title="WhatsApp reminders"
         />
      );
   }

   if (!code) {
      return (
         <>
            <OptionCard
               badge={required ? 'Required' : 'Recommended'}
               disabled={starting}
               icon={<i aria-hidden="true" className="fab fa-whatsapp text-[38px] leading-none text-[#25D366]" />}
               onClick={() => void start()}
               subtitle={starting ? 'Getting your code…' : 'Notifications can’t work here. Tap to get your code, then send it on WhatsApp.'}
               title="Get reminders on WhatsApp"
            />
            {error ? <p className="text-center text-md-b3 font-normal text-md-red-500">{error}</p> : null}
         </>
      );
   }

   return (
      <WhatsAppCodePanel
         code={code}
         copied={copied}
         onCopy={() => void copyCode()}
         onOpenTap={() => track('contact_whatsapp_reminders_open_tapped', { source })}
      />
   );
}

// The "waiting" state: open WhatsApp again, or send the code by hand. Exported for the design preview.
export function WhatsAppCodePanel({
   code,
   copied,
   onCopy,
   onOpenTap
}: {
   code: string;
   copied: boolean;
   onCopy: () => void;
   onOpenTap?: () => void;
}) {
   return (
      <div aria-live="polite" className="flex w-full flex-col gap-3 rounded-[18px] border-2 border-[#9fe3b4] bg-[#eefbf2] px-4 py-4 text-left">
         <span className="text-[18px] font-bold leading-[22px] text-[#1f7a3d]">Turn on WhatsApp reminders</span>
         {/* A real link the borrower taps: from script, some in-app browsers never hand wa.me to WhatsApp. */}
         <a
            href={buildWhatsAppVerifyLink(code)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onOpenTap}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 text-[16px] font-bold text-white"
         >
            <i aria-hidden="true" className="fab fa-whatsapp text-[22px] leading-none" />
            Open WhatsApp and hit send
         </a>
         <p className="text-[14px] leading-[19px] text-[#3f5a47]">
            WhatsApp didn&apos;t open? Send this code to <b className="whitespace-nowrap">{WHATSAPP_BUSINESS_NUMBER_DISPLAY}</b> on WhatsApp yourself:
         </p>
         <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-white px-3 py-2 text-center text-[20px] font-bold tracking-wide text-md-heading">{code}</code>
            <button
               type="button"
               onClick={onCopy}
               className="rounded-lg border border-[#9fe3b4] bg-white px-3 py-2 text-[13px] font-bold text-[#1f7a3d]"
            >
               {copied ? 'Copied' : 'Copy'}
            </button>
         </div>
         <p className="text-[13px] leading-[17px] text-[#5f7a66]">Keep this screen open. It turns green as soon as your message arrives.</p>
      </div>
   );
}
