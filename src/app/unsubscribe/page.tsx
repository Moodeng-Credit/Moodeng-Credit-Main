import { useState } from 'react';

import { useLocation } from 'react-router-dom';

// /unsubscribe?u=<user id>&t=<token> — from the link in an Admin → Campaigns email (via the
// email-unsubscribe function, which redirects here). Asks first, because mail scanners open links:
// only the button unsubscribes. No login needed; the signed token identifies the person.

const FUNCTION_URL = `${(import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '')}/functions/v1/email-unsubscribe`;

type State = 'ask' | 'working' | 'done' | 'resubscribed' | 'error';

export default function UnsubscribePage() {
   const params = new URLSearchParams(useLocation().search);
   const u = params.get('u') ?? '';
   const t = params.get('t') ?? '';
   const [state, setState] = useState<State>(u && t ? 'ask' : 'error');

   const submit = async (resubscribe: boolean) => {
      setState('working');
      try {
         const res = await fetch(FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ u, t, resubscribe })
         });
         const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
         setState(res.ok && data?.ok ? (resubscribe ? 'resubscribed' : 'done') : 'error');
      } catch {
         setState('error');
      }
   };

   const copy: Record<State, { title: string; body: string }> = {
      ask: { title: 'Unsubscribe from Moodeng updates?', body: "You'll stop getting news and offers by email. Emails about your loans and account still come through." },
      working: { title: 'One moment…', body: '' },
      done: { title: "You're unsubscribed", body: "We won't send you updates by email anymore. Changed your mind? You can undo it below." },
      resubscribed: { title: "You're back on the list", body: "Thanks! We'll keep you posted by email." },
      error: { title: "That link didn't work", body: 'It may be incomplete. Reply to any of our emails or message us on Facebook and we’ll take you off the list.' }
   };

   return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbfafd] px-4 dark:bg-[#08040f]">
         <div className="w-full max-w-[420px] rounded-2xl bg-white p-6 text-center shadow-sm dark:bg-[#140a22]">
            <img alt="" aria-hidden="true" className="mx-auto mb-4 size-20 object-contain" src="/hippos/welcome.png" />
            <h1 className="text-xl font-semibold text-[#2d2438] dark:text-[#ede6f7]">{copy[state].title}</h1>
            {copy[state].body ? <p className="mt-2 text-[15px] leading-6 text-[#594d65] dark:text-[#b8abc8]">{copy[state].body}</p> : null}
            {state === 'ask' ? (
               <button
                  className="mt-5 w-full rounded-full bg-[#6b55f7] px-4 py-3 text-base font-semibold text-white"
                  onClick={() => void submit(false)}
                  type="button"
               >
                  Unsubscribe
               </button>
            ) : null}
            {state === 'done' ? (
               <button
                  className="mt-5 w-full rounded-full border-2 border-[#6b55f7] px-4 py-3 text-base font-semibold text-[#6b55f7]"
                  onClick={() => void submit(true)}
                  type="button"
               >
                  Undo — keep me subscribed
               </button>
            ) : null}
         </div>
      </div>
   );
}
