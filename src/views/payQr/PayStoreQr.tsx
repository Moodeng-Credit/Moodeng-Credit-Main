import { useCallback, useEffect, useRef, useState } from 'react';

import jsQR from 'jsqr';
import { Camera, ImageUp, Loader2 } from 'lucide-react';

import useWallet, { useActivePaymentMethod } from '@/hooks/useWallet';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';

// /pay-qr: field test of Stableyard External QR payments for admins and the people in
// stableyard_qr_testers. Pay a Philippine store's QR Ph in pesos with USDC from your Moodeng wallet.
// Setup, scanning and the price quote move no money; only "Pay" does, after a confirm. Every quote is
// logged with the market rate (stableyard_qr_quotes) so we can measure Stableyard's real spread.
// English only while it's a test.

const BASE_CHAIN_ID = 8453;
const BASE_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const MAX_PHP = 2000;

type DepositInstructions = { address: string; chainId: number; tokenAddress: string; assetCode: string; decimals: number; amount: string };
type Quote = {
   usdc: number | null;
   marketRate: number | null;
   marketRateAt: string | null;
   fairUsdc: number | null;
   spreadPct: number | null;
};
type QrResponse = {
   ok?: boolean;
   error?: string;
   code?: string | null;
   emailVerified?: boolean;
   kycStatus?: string;
   kycApproved?: boolean;
   kycUrl?: string | null;
   sourceReady?: boolean;
   quote?: Quote;
   result?: {
      challenge?: { id?: string };
      verificationUrl?: string;
      payment?: { id?: string; status?: string; destination?: { merchant?: { name?: string } | null } };
      nextAction?: { depositInstructions?: DepositInstructions } | null;
      merchant?: { displayName?: string; name?: string };
      [key: string]: unknown;
   };
};
type Setup = { emailVerified: boolean; kycStatus: string; kycApproved: boolean; kycUrl: string | null; sourceReady: boolean };

const call = async (body: Record<string, unknown>): Promise<QrResponse & { httpStatus?: number }> => {
   const { data, error } = await getSupabaseBrowserClient().functions.invoke('stableyard-deposit-address', { body });
   if (!error) return (data as QrResponse) ?? { ok: false, error: 'No response' };
   const context = (error as { context?: { status?: number; json?: () => Promise<QrResponse> } }).context;
   const parsed = await context?.json?.().catch(() => null);
   return { ok: false, error: error.message, ...(parsed ?? {}), httpStatus: context?.status };
};

const merchantName = (data: QrResponse['result']) =>
   data?.merchant?.displayName ?? data?.merchant?.name ?? data?.payment?.destination?.merchant?.name ?? '';

const peso = (value: number) => `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

const primaryButton =
   'flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#6b55f7] text-[16px] font-semibold text-white shadow-[0_6px_16px_rgba(107,85,247,0.35)] active:scale-[0.98] disabled:opacity-50';
const secondaryButton =
   'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border-2 border-[#6b55f7] bg-white text-[15px] font-semibold text-[#6b55f7] active:scale-[0.98] disabled:opacity-50 dark:bg-transparent';
const card = 'rounded-[20px] border-2 border-[#e2dcee] bg-white p-4 dark:border-[#2a2338] dark:bg-[#17131f]';
const input =
   'w-full rounded-[14px] border-2 border-[#e2dcee] bg-white px-4 py-3 text-[16px] text-[#594d65] placeholder:text-[#b3a9bf] focus:border-[#7661f9] focus:outline-none dark:border-[#2a2338] dark:bg-transparent dark:text-white';
const muted = 'text-[14px] text-[#7b6b8c] dark:text-[#a89bb8]';
const heading = 'text-[18px] font-bold text-[#594d65] dark:text-white';

function SetupRow({ done, label }: { done: boolean; label: string }) {
   return (
      <li className="flex items-center gap-2 text-[15px] text-[#594d65] dark:text-white">
         <span className={done ? 'text-[#2f7a3a]' : 'text-[#b3a9bf]'}>{done ? '✓' : '○'}</span>
         {label}
      </li>
   );
}

/** Live camera QR scanner (rear camera, jsQR on each frame). Calls onCode once with the QR's text. */
function CameraScanner({ onCode, onClose }: { onCode: (text: string) => void; onClose: () => void }) {
   const videoRef = useRef<HTMLVideoElement>(null);
   const [error, setError] = useState('');

   useEffect(() => {
      let stream: MediaStream | null = null;
      let frame = 0;
      let stopped = false;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });

      const tick = () => {
         const video = videoRef.current;
         if (stopped || !video || !context) return;
         if (video.readyState >= 2 && video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0);
            const code = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
            if (code?.data) {
               stopped = true;
               onCode(code.data);
               return;
            }
         }
         frame = requestAnimationFrame(tick);
      };

      navigator.mediaDevices
         ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
         .then((media) => {
            stream = media;
            if (stopped) return media.getTracks().forEach((track) => track.stop());
            if (videoRef.current) {
               videoRef.current.srcObject = media;
               void videoRef.current.play();
            }
            frame = requestAnimationFrame(tick);
         })
         .catch(() => setError('Camera blocked. Allow the camera, or upload a photo of the QR instead.'));

      return () => {
         stopped = true;
         cancelAnimationFrame(frame);
         stream?.getTracks().forEach((track) => track.stop());
      };
   }, [onCode]);

   return (
      <div className="space-y-3">
         <div className="relative overflow-hidden rounded-[20px] bg-black">
            <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-[15%] rounded-[16px] border-4 border-white/80" />
         </div>
         {error ? (
            <p className="text-[14px] text-md-red-500">{error}</p>
         ) : (
            <p className={muted}>Point your camera at the store&apos;s QR Ph.</p>
         )}
         <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
         </button>
      </div>
   );
}

const readQrFromImage = (file: File) =>
   new Promise<string | null>((resolve) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
         const canvas = document.createElement('canvas');
         const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
         canvas.width = Math.round(image.width * scale);
         canvas.height = Math.round(image.height * scale);
         const context = canvas.getContext('2d');
         context?.drawImage(image, 0, 0, canvas.width, canvas.height);
         const data = context?.getImageData(0, 0, canvas.width, canvas.height);
         URL.revokeObjectURL(url);
         resolve(data ? (jsQR(data.data, canvas.width, canvas.height)?.data ?? null) : null);
      };
      image.onerror = () => {
         URL.revokeObjectURL(url);
         resolve(null);
      };
      image.src = url;
   });

export default function PayStoreQr() {
   const { payUsdc } = useWallet();
   const paymentMethod = useActivePaymentMethod();

   const [phase, setPhase] = useState<'loading' | 'blocked' | 'no_wallet' | 'setup' | 'scan' | 'amount' | 'quote' | 'paid'>('loading');
   const [setup, setSetup] = useState<Setup | null>(null);
   const [busy, setBusy] = useState<string | null>(null);
   const [error, setError] = useState('');
   const [challengeId, setChallengeId] = useState('');
   const [code, setCode] = useState('');
   const [scanning, setScanning] = useState(false);
   const [showPaste, setShowPaste] = useState(false);
   const [qrPayload, setQrPayload] = useState('');
   const [merchant, setMerchant] = useState('');
   const [amount, setAmount] = useState('');
   const [quote, setQuote] = useState<Quote | null>(null);
   const [deposit, setDeposit] = useState<DepositInstructions | null>(null);
   const [paymentId, setPaymentId] = useState('');
   const [paymentStatus, setPaymentStatus] = useState('');
   const [sentHash, setSentHash] = useState('');

   const loadSetup = useCallback(async () => {
      setBusy('setup');
      setError('');
      const res = await call({ qr: 'setup' });
      setBusy(null);
      if (res.code === 'not_tester' || res.httpStatus === 403) return setPhase('blocked');
      if (res.code === 'no_wallet') return setPhase('no_wallet');
      if (!res.ok) {
         setError(res.error ?? 'Something went wrong. Try again.');
         return setPhase('setup');
      }
      const next: Setup = {
         emailVerified: Boolean(res.emailVerified),
         kycStatus: res.kycStatus ?? 'unknown',
         kycApproved: Boolean(res.kycApproved),
         kycUrl: res.kycUrl ?? null,
         sourceReady: Boolean(res.sourceReady)
      };
      setSetup(next);
      setPhase(next.emailVerified && next.kycApproved && next.sourceReady ? 'scan' : 'setup');
   }, []);

   useEffect(() => {
      void loadSetup();
   }, [loadSetup]);

   const onboarding = async (step: string, extra: Record<string, string> = {}) => {
      setBusy(step);
      setError('');
      const res = await call({ onboarding: step, ...extra });
      setBusy(null);
      if (!res.ok) return setError(res.error ?? 'Something went wrong. Try again.');
      if (res.result?.challenge?.id) setChallengeId(res.result.challenge.id);
      if (step === 'email_confirm') await loadSetup();
      if (step === 'kyc_start') {
         const url = res.result?.verificationUrl;
         if (url) window.open(url, '_blank', 'noopener,noreferrer');
         setSetup((current) => (current ? { ...current, kycUrl: url ?? current.kycUrl } : current));
      }
   };

   const decode = useCallback(async (text: string) => {
      const payload = text.trim();
      setScanning(false);
      setQrPayload(payload);
      setBusy('decode');
      setError('');
      const res = await call({ qr: 'decode', country: 'PH', qrPayload: payload });
      setBusy(null);
      if (!res.ok) {
         setError(
            res.code === 'personal_qr_not_supported'
               ? "That's a personal QR (like a friend's GCash). Only store QRs work."
               : (res.error ?? "Couldn't read that QR.")
         );
         return;
      }
      setMerchant(merchantName(res.result) || 'this store');
      setPhase('amount');
   }, []);

   const onPhoto = async (file: File | undefined) => {
      if (!file) return;
      setBusy('photo');
      const text = await readQrFromImage(file);
      setBusy(null);
      if (text) await decode(text);
      else setError('No QR found in that photo. Try a closer, sharper photo.');
   };

   const getQuote = async () => {
      setBusy('create');
      setError('');
      const res = await call({ qr: 'create', country: 'PH', qrPayload, amount, merchant, requestKey: crypto.randomUUID() });
      setBusy(null);
      const instructions = res.result?.nextAction?.depositInstructions;
      if (!res.ok || !instructions) return setError(res.error ?? 'No price came back. Try again.');
      setDeposit(instructions);
      setQuote(res.quote ?? null);
      setPaymentId(res.result?.payment?.id ?? '');
      setPhase('quote');
   };

   const canPay =
      deposit !== null && deposit.chainId === BASE_CHAIN_ID && deposit.tokenAddress.toLowerCase() === BASE_USDC && deposit.decimals === 6;

   const pay = async () => {
      if (!deposit || !canPay) return;
      if (!window.confirm(`Send ${deposit.amount} USDC from your Moodeng wallet to pay ${peso(Number(amount))} to ${merchant}?`)) return;
      setBusy('pay');
      setError('');
      const outcome = await payUsdc({
         method: paymentMethod,
         to: deposit.address,
         usdAmount: deposit.amount,
         loanId: `stableyard-qr:${paymentId}`
      });
      setBusy(null);
      if (!outcome) return;
      setSentHash(outcome.hash);
      setPhase('paid');
      if (paymentId && /^0x[0-9a-fA-F]{64}$/.test(outcome.hash)) void call({ qr: 'sent', paymentId, txHash: outcome.hash });
   };

   const checkPayment = async () => {
      if (!paymentId) return;
      setBusy('get');
      const res = await call({ qr: 'get', paymentId });
      setBusy(null);
      setPaymentStatus(res.ok ? (res.result?.payment?.status ?? 'unknown') : (res.error ?? 'Could not check'));
   };

   const tryAnotherAmount = () => {
      setDeposit(null);
      setQuote(null);
      setPaymentId('');
      setPhase('amount');
   };

   const startOver = () => {
      tryAnotherAmount();
      setQrPayload('');
      setMerchant('');
      setAmount('');
      setSentHash('');
      setPaymentStatus('');
      setPhase('scan');
   };

   const amountNumber = Number(amount);
   const amountValid = /^\d+(\.\d{1,2})?$/.test(amount) && amountNumber > 0 && amountNumber <= MAX_PHP;

   return (
      <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col bg-[#faf9fd] dark:bg-[#100d17]">
         <OnboardingHeader title="Pay a store QR" tooltip="Test feature. Only store QR Ph codes work, up to ₱2,000." />
         <div className="flex flex-1 flex-col gap-4 px-5 pb-8 pt-2">
            <div className="mx-auto w-fit rounded-full bg-[#fff6d6] px-3 py-1 text-[13px] font-semibold text-[#704518]">
               Test · pay stores in pesos with USDC
            </div>

            {phase === 'loading' ? (
               <div className="flex flex-1 items-center justify-center">
                  <Loader2 className="size-8 animate-spin text-[#6b55f7]" />
               </div>
            ) : null}

            {phase === 'blocked' ? (
               <div className={card}>
                  <p className={heading}>Not open yet</p>
                  <p className={`${muted} mt-1`}>This test is only for a few testers. Ask the Moodeng team to add you.</p>
               </div>
            ) : null}

            {phase === 'no_wallet' ? (
               <div className={card}>
                  <p className={heading}>Set up your wallet first</p>
                  <p className={`${muted} mt-1`}>You need your Moodeng wallet to pay. Set it up, then come back here.</p>
                  <a href="/onboarding/wallet" className={`${primaryButton} mt-3`}>
                     Set up wallet
                  </a>
               </div>
            ) : null}

            {phase === 'setup' && setup ? (
               <div className={`${card} space-y-4`}>
                  <div>
                     <p className={heading}>One-time setup</p>
                     <p className={`${muted} mt-1`}>Our payment partner needs to check your email and ID once.</p>
                  </div>
                  <ul className="space-y-1.5">
                     <SetupRow done={setup.emailVerified} label="Email checked" />
                     <SetupRow
                        done={setup.kycApproved}
                        label={`ID checked${setup.kycApproved ? '' : ` (${setup.kycStatus.replace(/_/g, ' ')})`}`}
                     />
                     <SetupRow done={setup.sourceReady} label="Pays from your Moodeng wallet" />
                  </ul>

                  {!setup.emailVerified ? (
                     <div className="space-y-2">
                        <button
                           type="button"
                           onClick={() => void onboarding('email_start')}
                           disabled={busy !== null}
                           className={secondaryButton}
                        >
                           {busy === 'email_start' ? 'Sending…' : challengeId ? 'Send a new code' : 'Email me a code'}
                        </button>
                        {challengeId ? (
                           <div className="flex gap-2">
                              <input
                                 value={code}
                                 onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                 inputMode="numeric"
                                 placeholder="6-digit code"
                                 className={input}
                              />
                              <button
                                 type="button"
                                 onClick={() => void onboarding('email_confirm', { challengeId, code })}
                                 disabled={busy !== null || code.length !== 6}
                                 className="shrink-0 rounded-full bg-[#6b55f7] px-5 text-[15px] font-semibold text-white disabled:opacity-50"
                              >
                                 {busy === 'email_confirm' ? '…' : 'OK'}
                              </button>
                           </div>
                        ) : null}
                     </div>
                  ) : null}

                  {setup.emailVerified && !setup.kycApproved ? (
                     <div className="space-y-2">
                        <button
                           type="button"
                           onClick={() => void onboarding('kyc_start')}
                           disabled={busy !== null}
                           className={secondaryButton}
                        >
                           {busy === 'kyc_start' ? 'Opening…' : 'Check my ID'}
                        </button>
                        {setup.kycUrl ? (
                           <a
                              href={setup.kycUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-center text-[14px] font-semibold text-[#6b55f7] underline"
                           >
                              Open the ID check again
                           </a>
                        ) : null}
                     </div>
                  ) : null}

                  <button type="button" onClick={() => void loadSetup()} disabled={busy !== null} className={primaryButton}>
                     {busy === 'setup' ? 'Checking…' : "I'm done, check again"}
                  </button>
                  <button
                     type="button"
                     onClick={() => setPhase('scan')}
                     className="w-full text-center text-[13px] text-[#877897] underline"
                  >
                     Skip ahead (testers)
                  </button>
               </div>
            ) : null}

            {phase === 'scan' ? (
               <div className={`${card} space-y-3`}>
                  <div>
                     <p className={heading}>Scan the store&apos;s QR</p>
                     <p className={`${muted} mt-1`}>Use the QR Ph at the counter. Personal GCash or Maya QRs don&apos;t work.</p>
                  </div>
                  {scanning ? (
                     <CameraScanner onCode={(text) => void decode(text)} onClose={() => setScanning(false)} />
                  ) : (
                     <>
                        <button type="button" onClick={() => setScanning(true)} disabled={busy !== null} className={primaryButton}>
                           <Camera className="size-5" /> {busy === 'decode' ? 'Reading QR…' : 'Scan with camera'}
                        </button>
                        <label className={`${secondaryButton} cursor-pointer`}>
                           <ImageUp className="size-5" /> {busy === 'photo' ? 'Reading photo…' : 'Upload a photo of the QR'}
                           <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              onChange={(event) => {
                                 void onPhoto(event.target.files?.[0]);
                                 event.target.value = '';
                              }}
                           />
                        </label>
                        {showPaste ? (
                           <div className="space-y-2">
                              <textarea
                                 value={qrPayload}
                                 onChange={(event) => setQrPayload(event.target.value)}
                                 rows={3}
                                 placeholder="QR text, starts with 000201…"
                                 className={`${input} font-mono text-[13px]`}
                              />
                              <button
                                 type="button"
                                 onClick={() => void decode(qrPayload)}
                                 disabled={busy !== null || !qrPayload.trim()}
                                 className={secondaryButton}
                              >
                                 Read this QR text
                              </button>
                           </div>
                        ) : (
                           <button
                              type="button"
                              onClick={() => setShowPaste(true)}
                              className="w-full text-center text-[13px] text-[#877897] underline"
                           >
                              Paste the QR text instead
                           </button>
                        )}
                     </>
                  )}
               </div>
            ) : null}

            {phase === 'amount' ? (
               <div className={`${card} space-y-3`}>
                  <div>
                     <p className={muted}>Paying</p>
                     <p className={heading}>{merchant}</p>
                  </div>
                  <div className="relative">
                     <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] font-bold text-[#594d65] dark:text-white">
                        ₱
                     </span>
                     <input
                        value={amount}
                        onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ''))}
                        inputMode="decimal"
                        placeholder="0"
                        className={`${input} pl-9 text-[24px] font-bold`}
                     />
                  </div>
                  <p className={muted}>Up to {peso(MAX_PHP)} while we test. Getting a price doesn&apos;t move any money.</p>
                  <button type="button" onClick={() => void getQuote()} disabled={busy !== null || !amountValid} className={primaryButton}>
                     {busy === 'create' ? 'Getting price…' : 'See the price in USDC'}
                  </button>
                  <button type="button" onClick={startOver} className="w-full text-center text-[13px] text-[#877897] underline">
                     Scan a different QR
                  </button>
               </div>
            ) : null}

            {phase === 'quote' && deposit ? (
               <div className={`${card} space-y-3`}>
                  <p className={muted}>
                     {merchant} gets <span className="font-semibold text-[#594d65] dark:text-white">{peso(amountNumber)}</span>
                  </p>
                  <p className="text-[32px] font-bold leading-[36px] text-[#594d65] dark:text-white">{deposit.amount} USDC</p>
                  <div className="space-y-1 rounded-[14px] bg-[#f5f4fa] p-3 text-[14px] text-[#594d65] dark:bg-[#211a2e] dark:text-white">
                     <div className="flex justify-between">
                        <span>Your rate</span>
                        <span className="font-semibold">{peso(amountNumber / Number(deposit.amount))} per USDC</span>
                     </div>
                     {quote?.marketRate ? (
                        <>
                           <div className="flex justify-between">
                              <span>Market rate</span>
                              <span>{peso(quote.marketRate)} per $1</span>
                           </div>
                           <div className="flex justify-between">
                              <span>Fee (all-in)</span>
                              <span
                                 className={`font-semibold ${quote.spreadPct !== null && quote.spreadPct > 2 ? 'text-md-red-500' : 'text-[#2f7a3a]'}`}
                              >
                                 {quote.spreadPct !== null ? `${quote.spreadPct.toFixed(2)}%` : '—'}
                                 {quote.fairUsdc ? ` (${(Number(deposit.amount) - quote.fairUsdc).toFixed(3)} USDC)` : ''}
                              </span>
                           </div>
                        </>
                     ) : null}
                  </div>
                  {canPay ? (
                     <button type="button" onClick={() => void pay()} disabled={busy !== null} className={primaryButton}>
                        {busy === 'pay' ? 'Paying…' : `Pay ${deposit.amount} USDC`}
                     </button>
                  ) : (
                     <p className="text-[14px] text-md-red-500">This price isn&apos;t in USDC on Base, so the app can&apos;t pay it.</p>
                  )}
                  <button type="button" onClick={tryAnotherAmount} disabled={busy !== null} className={secondaryButton}>
                     Try another amount
                  </button>
                  <p className="text-center text-[12px] text-[#877897]">
                     Price holds for a short time. If you don&apos;t pay, nothing happens.
                  </p>
               </div>
            ) : null}

            {phase === 'paid' ? (
               <div className={`${card} space-y-3 text-center`}>
                  <p className="text-[40px]">✅</p>
                  <p className={heading}>Sent {deposit?.amount} USDC</p>
                  <p className={muted}>
                     Ask {merchant} to check they got exactly {peso(amountNumber)}.
                  </p>
                  <button type="button" onClick={() => void checkPayment()} disabled={busy !== null} className={secondaryButton}>
                     {busy === 'get' ? 'Checking…' : 'Check payment status'}
                  </button>
                  {paymentStatus ? (
                     <p className="text-[14px] font-semibold text-[#594d65] dark:text-white">Status: {paymentStatus}</p>
                  ) : null}
                  <a
                     href={`https://basescan.org/tx/${sentHash}`}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="block text-[13px] text-[#6b55f7] underline"
                  >
                     View on Basescan
                  </a>
                  <button type="button" onClick={startOver} className={primaryButton}>
                     Pay another store
                  </button>
               </div>
            ) : null}

            {error ? <p className="text-center text-[14px] text-md-red-500">{error}</p> : null}
         </div>
      </div>
   );
}
