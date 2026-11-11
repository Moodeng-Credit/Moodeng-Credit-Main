import { type ButtonHTMLAttributes, useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { phNetwork } from '@/lib/phoneAuth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { CONNECT_HIPPOS, ConnectHero, GhostButton } from '@/views/dashboard/components/connectKit';

// moodeng.app/sms-test?t=<token> — the link the team sends people to test whether Sprint SMS texts reach
// their phone. They type their number + network, we text a 6-digit code (Sprint only), and if they type it
// back they get a ₱50 food link right here. "I didn't get it" shows after a minute and is logged too.
// Everything runs in the database (sms_test_* in 20261109150000_sms_test_page.sql), which also posts each
// result to Discord #rewards. No sign-in: the token in the link is the key.

export type SmsTestStage =
   | 'loading'
   | 'bad_link'
   | 'closed'
   | 'fully_tested'
   | 'form'
   | 'covered'
   | 'code'
   | 'won'
   | 'not_received'
   | 'already_done';
export type SmsTestPreview = { stage: SmsTestStage; link?: string | null; owed?: boolean; phone?: string; done?: string[] };

// Only the networks UniSMS can't reach. Globe (with TM/GOMO) and DITO already get codes, so a Globe or
// DITO number is turned away here and in sms_test_send ('covered') before it uses up a ₱50 link.
const NETWORKS = [
   { id: 'smart', label: 'Smart' },
   { id: 'tnt', label: 'TNT' },
   { id: 'sun', label: 'Sun' },
   { id: 'not_sure', label: 'Not sure' }
] as const;

const SENDERS = ['Moodeng', 'Verify', 'Notify', 'A number', 'Other'] as const;

const WAIT_BEFORE_NOT_RECEIVED_S = 60;

const TESTED_NETWORKS = ['smart', 'tnt', 'sun'];
const allTested = (done: string[]) => TESTED_NETWORKS.every((n) => done.includes(n));

/** A Globe/TM/GOMO or DITO number by its prefix: UniSMS already texts those, nothing to test. */
function isCoveredNumber(raw: string): boolean {
   const d = raw.replace(/\D/g, '');
   const local = d.startsWith('63') ? d.slice(2) : d.startsWith('0') ? d.slice(1) : d;
   const network = phNetwork(`+63${local}`);
   return network === 'globe' || network === 'dito';
}

const ERRORS: Record<string, string> = {
   bad_phone: 'Please type a PH mobile number, like 0918 123 4567.',
   bad_network: 'Please pick your network.',
   network_done: 'We already tested that network. Thank you!',
   wait: 'Please wait a minute before asking for another code.',
   too_many: 'Too many tries for now. Please message us on Facebook.',
   wrong_code: 'That code doesn’t match. Check the text and try again.',
   expired: 'This code expired. Ask for a new one.',
   not_found: 'Something went wrong. Please start again.'
};

const fieldClass =
   'w-full rounded-[12px] border-2 border-[#e2dcee] bg-white px-3 py-2.5 text-[16px] text-[#3b2f4a] placeholder:text-[#b3a9c2] focus:border-[#7661f9] focus:outline-none dark:border-[#3a2d4f] dark:bg-[#1b1526] dark:text-[#f5f0ff]';
const chipClass = (on: boolean) =>
   `min-h-[44px] rounded-[12px] border-2 px-3 text-[15px] font-bold transition ${
      on
         ? 'border-[#6b55f7] bg-[#6b55f7] text-white'
         : 'border-[#e2dcee] bg-white text-[#594d65] dark:border-[#3a2d4f] dark:bg-[#1b1526] dark:text-[#d9cfe8]'
   }`;
const card = 'flex flex-col gap-4 rounded-[20px] bg-white px-5 py-5 dark:bg-dv2-card';
const label = 'mb-1.5 block text-[14px] font-bold text-[#594d65] dark:text-[#d9cfe8]';

const goldClass =
   'flex min-h-[54px] w-full items-center justify-center rounded-[16px] bg-[#f5b301] px-5 text-[17px] font-bold text-[#3b2f4a] shadow-[0_4px_0_#c98f00] transition duration-100 ease-out active:translate-y-[4px] active:shadow-none';

// Main action, gold like the other borrower screens.
function GoldButton({ children, disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
   return (
      <button
         className={
            disabled
               ? 'min-h-[54px] w-full cursor-not-allowed rounded-[16px] bg-[#e8e3ef] px-5 text-[17px] font-bold text-[#a99fb6] shadow-[0_4px_0_#d6cfe0] dark:bg-[#2a2235] dark:text-[#6f6280] dark:shadow-[0_4px_0_#1c1626]'
               : goldClass
         }
         disabled={disabled}
         type="button"
         {...rest}
      >
         {children}
      </button>
   );
}

type Result = {
   ok?: boolean;
   error?: string;
   open?: boolean;
   done?: string[];
   test_id?: string;
   link?: string | null;
   owed?: boolean;
   already_rewarded?: boolean;
   tries_left?: number;
};

export default function SmsTestPage({ preview }: { preview?: SmsTestPreview } = {}) {
   const token = new URLSearchParams(useLocation().search).get('t') ?? '';
   const [stage, setStage] = useState<SmsTestStage>(preview?.stage ?? 'loading');
   const [phone, setPhone] = useState(preview?.phone ?? '');
   const [network, setNetwork] = useState<string>('');
   // Networks someone already got a code on: greyed out, no more ₱50 for them.
   const [done, setDone] = useState<string[]>(preview?.done ?? []);
   const [name, setName] = useState('');
   const [testId, setTestId] = useState<string | null>(null);
   const [code, setCode] = useState('');
   const [sender, setSender] = useState<string>('');
   const [link, setLink] = useState<string | null>(preview?.link ?? null);
   const [owed, setOwed] = useState(preview?.owed ?? false);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [secondsSinceSend, setSecondsSinceSend] = useState(0);

   useEffect(() => {
      if (preview) return;
      let cancelled = false;
      void getSupabaseBrowserClient()
         .rpc('sms_test_status', { p_token: token })
         .then(({ data, error: rpcError }) => {
            if (cancelled) return;
            const r = data as Result | null;
            if (rpcError || !r?.ok) return setStage('bad_link');
            setDone(r.done ?? []);
            if (allTested(r.done ?? [])) return setStage('fully_tested');
            setStage(r.open ? 'form' : 'closed');
         });
      return () => {
         cancelled = true;
      };
   }, [preview, token]);

   useEffect(() => {
      if (stage !== 'code') return;
      setSecondsSinceSend(0);
      const timer = window.setInterval(() => setSecondsSinceSend((s) => s + 1), 1000);
      return () => window.clearInterval(timer);
   }, [stage, testId]);

   const call = async (fn: string, args: Record<string, unknown>): Promise<Result | null> => {
      if (preview) return null;
      setBusy(true);
      setError(null);
      const { data, error: rpcError } = await getSupabaseBrowserClient().rpc(fn, { p_token: token, ...args });
      setBusy(false);
      if (rpcError) {
         setError('Something went wrong. Please try again.');
         return null;
      }
      return data as Result;
   };

   const sendCode = async () => {
      if (isCoveredNumber(phone)) return setStage('covered');
      const r = await call('sms_test_send', { p_phone: phone, p_network: network, p_name: name || null });
      if (!r) return;
      if (r.ok && r.test_id) {
         setTestId(r.test_id);
         setCode('');
         setStage('code');
      } else if (r.error === 'covered') setStage('covered');
      else if (r.error === 'fully_tested') setStage('fully_tested');
      else if (r.error === 'network_done') {
         setDone((d) => (d.includes(network) ? d : [...d, network]));
         setNetwork('');
         setError(ERRORS.network_done);
      } else if (r.error === 'already_done') setStage('already_done');
      else if (r.error === 'closed') setStage('closed');
      else if (r.error === 'bad_link') setStage('bad_link');
      else setError(ERRORS[r.error ?? ''] ?? 'Something went wrong. Please try again.');
   };

   const checkCode = async () => {
      const r = await call('sms_test_check', { p_test_id: testId, p_code: code, p_sender: sender || null });
      if (!r) return;
      if (r.ok) {
         if (r.already_rewarded) return setStage('already_done');
         setLink(r.link ?? null);
         setOwed(Boolean(r.owed));
         setStage('won');
      } else if (r.error === 'wrong_code') {
         setError(`${ERRORS.wrong_code}${typeof r.tries_left === 'number' ? ` (${Math.max(0, r.tries_left)} tries left)` : ''}`);
      } else setError(ERRORS[r.error ?? ''] ?? 'Something went wrong. Please try again.');
   };

   const notReceived = async () => {
      const r = await call('sms_test_not_received', { p_test_id: testId });
      if (r?.ok || preview) setStage('not_received');
   };

   const canSend = phone.replace(/\D/g, '').length >= 10 && Boolean(network) && !busy;
   const canCheck = code.replace(/\D/g, '').length === 6 && !busy;
   const waitLeft = Math.max(0, WAIT_BEFORE_NOT_RECEIVED_S - secondsSinceSend);

   return (
      <div className="min-h-screen bg-dv2-page">
         <div className="mx-auto flex max-w-[440px] flex-col gap-4 px-4 pb-28">
            <header className="flex h-16 items-end justify-center pb-1">
               <h1 className="text-[24px] font-semibold leading-[1.1] tracking-[-0.48px] text-[#594d65] dark:text-[#e6def2]">SMS test</h1>
            </header>

            {stage === 'loading' ? (
               <div className="mt-4 h-[260px] animate-pulse rounded-[16px] bg-[#ece9f1] dark:bg-dv2-card" aria-busy="true" />
            ) : null}

            {stage === 'bad_link' ? (
               <div className={card}>
                  <ConnectHero
                     image={CONNECT_HIPPOS.missed}
                     title="This link doesn’t work"
                     subtitle="Ask the person who sent it for a new one."
                  />
               </div>
            ) : null}

            {stage === 'closed' ? (
               <div className={card}>
                  <ConnectHero
                     image={CONNECT_HIPPOS.waiting}
                     title="The test is full"
                     subtitle="Thank you! We have all the testers we need for now."
                  />
               </div>
            ) : null}

            {stage === 'fully_tested' ? (
               <div className={card}>
                  <ConnectHero
                     image={CONNECT_HIPPOS.approved}
                     title="Fully tested! 🎉"
                     subtitle="Thank you so much! And sorry if it wasn’t available for you to test."
                  />
               </div>
            ) : null}

            {stage === 'already_done' ? (
               <div className={card}>
                  <ConnectHero
                     image={CONNECT_HIPPOS.connected}
                     title="You already did this!"
                     subtitle="This number already got its ₱50. Thank you for helping!"
                  />
               </div>
            ) : null}

            {stage === 'form' ? (
               <div className={card}>
                  <ConnectHero
                     image={CONNECT_HIPPOS.hello}
                     title="Smart, TNT or Sun? Get ₱50"
                     subtitle="We text you a code. Type it here and get a ₱50 food voucher."
                  />
                  <div>
                     <label className={label} htmlFor="sms-test-phone">
                        Your mobile number
                     </label>
                     <input
                        autoComplete="tel"
                        className={fieldClass}
                        id="sms-test-phone"
                        inputMode="tel"
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0918 123 4567"
                        value={phone}
                     />
                  </div>
                  <div>
                     <span className={label}>Your network</span>
                     <div className="grid grid-cols-2 gap-2">
                        {NETWORKS.map((n) => {
                           const isDone = n.id !== 'not_sure' && done.includes(n.id);
                           return (
                              <button
                                 className={
                                    isDone
                                       ? 'min-h-[44px] cursor-not-allowed rounded-[12px] border-2 border-[#ece9f1] bg-[#f3f1f6] px-3 text-[15px] font-bold text-[#b3a9c2] dark:border-[#2a2238] dark:bg-[#151020] dark:text-[#5f526f]'
                                       : chipClass(network === n.id)
                                 }
                                 disabled={isDone}
                                 key={n.id}
                                 onClick={() => setNetwork(n.id)}
                                 type="button"
                              >
                                 {isDone ? `${n.label} ✓ done` : n.label}
                              </button>
                           );
                        })}
                     </div>
                  </div>
                  <div>
                     <label className={label} htmlFor="sms-test-name">
                        Your name <span className="font-normal text-[#8a7c9c]">(optional)</span>
                     </label>
                     <input
                        autoComplete="given-name"
                        className={fieldClass}
                        id="sms-test-name"
                        maxLength={60}
                        onChange={(e) => setName(e.target.value)}
                        value={name}
                     />
                  </div>
                  {error ? <p className="text-[14px] font-semibold text-[#c2410c]">{error}</p> : null}
                  <GoldButton disabled={!canSend} onClick={() => void sendCode()}>
                     {busy ? <Loader2 aria-label="Sending" className="mx-auto size-5 animate-spin" /> : 'Text me a code'}
                  </GoldButton>
               </div>
            ) : null}

            {stage === 'covered' ? (
               <div className={card}>
                  <ConnectHero
                     image={CONNECT_HIPPOS.connected}
                     title="Your network already works!"
                     subtitle="We already text Globe, TM, GOMO and DITO. This test is only for Smart, TNT and Sun. Thank you!"
                  />
                  <GhostButton
                     onClick={() => {
                        setError(null);
                        setStage('form');
                     }}
                  >
                     Use another number
                  </GhostButton>
               </div>
            ) : null}

            {stage === 'code' ? (
               <div className={card}>
                  <ConnectHero
                     image={CONNECT_HIPPOS.codeCopied}
                     title="Check your texts"
                     subtitle="The code may come from “Moodeng”, “Verify” or “Notify”."
                  />
                  <div>
                     <label className={label} htmlFor="sms-test-code">
                        6-digit code
                     </label>
                     <input
                        autoComplete="one-time-code"
                        className={`${fieldClass} text-center text-[24px] font-bold tracking-[0.3em]`}
                        id="sms-test-code"
                        inputMode="numeric"
                        maxLength={6}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="••••••"
                        value={code}
                     />
                  </div>
                  <div>
                     <span className={label}>Who was the text from?</span>
                     <div className="flex flex-wrap gap-2">
                        {SENDERS.map((s) => (
                           <button
                              className={chipClass(sender === s)}
                              key={s}
                              onClick={() => setSender(sender === s ? '' : s)}
                              type="button"
                           >
                              {s}
                           </button>
                        ))}
                     </div>
                  </div>
                  {error ? <p className="text-[14px] font-semibold text-[#c2410c]">{error}</p> : null}
                  <GoldButton disabled={!canCheck} onClick={() => void checkCode()}>
                     {busy ? <Loader2 aria-label="Checking" className="mx-auto size-5 animate-spin" /> : 'Get my ₱50'}
                  </GoldButton>
                  {waitLeft > 0 ? (
                     <p className="text-center text-[14px] text-[#8a7c9c] dark:text-[#a99cbb]">No text yet? Wait {waitLeft}s…</p>
                  ) : (
                     <GhostButton disabled={busy} onClick={() => void notReceived()}>
                        I didn’t get a text
                     </GhostButton>
                  )}
               </div>
            ) : null}

            {stage === 'won' ? (
               <div className={card}>
                  <ConnectHero image={CONNECT_HIPPOS.approved} title="It worked! Thank you 🎉" subtitle="Here’s your ₱50 food voucher." />
                  {link ? (
                     <>
                        <a className={goldClass} href={link} rel="noreferrer" target="_blank">
                           Open my ₱50 voucher
                        </a>
                        <p className="text-center text-[14px] leading-[19px] text-[#7b6b8c] dark:text-[#b9abcc]">
                           Pick Jollibee, Chowking, Greenwich, Mang Inasal or Red Ribbon. Save this link — it works for a year.
                        </p>
                        <p className="break-all rounded-[12px] bg-[#f8f1ff] px-3 py-2 text-center text-[13px] text-[#594d65] dark:bg-[#221a31] dark:text-[#d9cfe8]">
                           {link}
                        </p>
                     </>
                  ) : (
                     <p className="text-center text-[15px] leading-[21px] text-[#594d65] dark:text-[#d9cfe8]">
                        {owed ? 'Our team will send your ₱50 voucher to you soon.' : 'Thank you for helping!'}
                     </p>
                  )}
               </div>
            ) : null}

            {stage === 'not_received' ? (
               <div className={card}>
                  <ConnectHero
                     image={CONNECT_HIPPOS.missed}
                     title="Thanks for telling us"
                     subtitle="That helps us fix it. You can try one more time."
                  />
                  <GoldButton
                     onClick={() => {
                        setError(null);
                        setStage('form');
                     }}
                  >
                     Try again
                  </GoldButton>
               </div>
            ) : null}
         </div>
      </div>
   );
}
