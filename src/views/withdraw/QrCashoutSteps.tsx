import { useCallback, useRef, useState } from 'react';

import { Camera, Check, ChevronDown, ImageUp, Loader2, QrCode } from 'lucide-react';

import { useUsdcRate } from '@/lib/useUsdcRate';
import { Card, DoneRow, GoldButton, SoftButton, StepHead } from '@/views/indonesia/ui';
import { readQrFromImage, useQrCamera } from '@/views/payQr/qrReader';

// Cash out to your own bank's QR (InstaPay / QR Ph "Receive" QR), in the same gold look as the PDAX /
// GCrypto guides: 1 add your QR (an example picture, 3 short lines, one gold button), 2 type the pesos. The
// price, the send and the payout tracker come after, from BankPayoutFlow (same Stableyard account and
// one-time setup as the bank cash-out). Money only moves on its Confirm.

export type DecodeReply = { ok: boolean; name?: string; code?: string | null; error?: string };

const TRAIL = ['Your QR', 'Pesos', 'Cash out'];
// Same rough fee share as the bank card (Stableyard 0.5% + their payout partner); the real figure is on the price screen.
const FEE_SHARE = 0.022;
// How to get the QR, in as few words as it takes. The pictures open under "Where is my QR?".
const HOW = ['Open your bank app', 'Tap Receive or QR', 'Save it or screenshot'];
const HELP_PICTURES = [
   { img: '/cashout-guides/qr/step1-receive.svg', text: 'Tap Receive' },
   { img: '/cashout-guides/qr/step2-save.svg', text: 'Tap Save QR' }
];

/** The 3 dots on top (same look as the exchange cash-out trail). */
export function QrTrail({ step }: { step: 0 | 1 | 2 }) {
   return (
      <div>
         <ol className="flex items-center justify-between gap-1" aria-label={`Step ${step + 1} of ${TRAIL.length}`}>
            {TRAIL.map((label, i) => {
               const done = i < step;
               const current = i === step;
               return (
                  <li key={label} className="flex flex-1 items-center last:flex-none">
                     <span
                        aria-current={current ? 'step' : undefined}
                        className={`grid size-9 shrink-0 place-items-center rounded-full text-[15px] font-extrabold ${
                           done
                              ? 'bg-[#2f9e44] text-white'
                              : current
                                ? 'bg-[#ffd75a] text-[#4a2a00] ring-4 ring-[#ffe9a8] dark:ring-[#4a3a10]'
                                : 'bg-[#efe6cc] text-[#9a8a6a] dark:bg-[#2a2335] dark:text-[#8a7f99]'
                        }`}
                     >
                        {done ? <Check aria-hidden="true" className="size-4" strokeWidth={3.5} /> : i + 1}
                     </span>
                     {i < TRAIL.length - 1 ? (
                        <span className={`mx-1 h-1 flex-1 rounded-full ${done ? 'bg-[#2f9e44]' : 'bg-[#efe6cc] dark:bg-[#2a2335]'}`} />
                     ) : null}
                  </li>
               );
            })}
         </ol>
         <p className="mt-2 text-center text-[14px] font-bold text-[#7a6a4f] dark:text-[#bfb29a]">
            Step {step + 1} of {TRAIL.length} · {TRAIL[step]}
         </p>
      </div>
   );
}

function CameraView({ onCode, onClose }: { onCode: (text: string) => void; onClose: () => void }) {
   const videoRef = useRef<HTMLVideoElement>(null);
   const error = useQrCamera(videoRef, onCode);
   return (
      <div className="flex flex-col gap-3">
         <div className="relative overflow-hidden rounded-[16px] bg-black">
            <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-[15%] rounded-[16px] border-4 border-white/80" />
         </div>
         <p className={`text-center text-[15px] font-semibold ${error ? 'text-[#c0392b]' : 'text-[#7a6a4f] dark:text-[#bfb29a]'}`}>
            {error || 'Point it at your QR.'}
         </p>
         <SoftButton onClick={onClose}>Cancel</SoftButton>
      </div>
   );
}

const peso = (n: number) => `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

export default function QrCashoutSteps({
   spendable,
   amount,
   setAmount,
   minPhp,
   maxPhp,
   busy,
   error,
   qrName,
   hasQr,
   decode,
   onClearQr,
   onGetPrice,
   onUseBank
}: {
   spendable: number | null;
   amount: string;
   setAmount: (value: string) => void;
   minPhp: number;
   maxPhp: number;
   busy: boolean;
   error: string;
   qrName: string;
   hasQr: boolean;
   /** Reads the QR with Stableyard; on ok the parent keeps the payload + name (hasQr turns true). */
   decode: (payload: string) => Promise<DecodeReply>;
   onClearQr: () => void;
   onGetPrice: () => void;
   /** Offered when Stableyard won't take this QR: cash out with the account number instead. */
   onUseBank?: () => void;
}) {
   const [reading, setReading] = useState(false);
   const [scanning, setScanning] = useState(false);
   const [qrError, setQrError] = useState('');
   const [notTaken, setNotTaken] = useState(false);
   const [showHelp, setShowHelp] = useState(false);
   const fileRef = useRef<HTMLInputElement>(null);
   const { value: phpPerUsdc } = useUsdcRate('php');

   const read = useCallback(
      async (text: string) => {
         setScanning(false);
         setReading(true);
         setQrError('');
         setNotTaken(false);
         const res = await decode(text.trim());
         setReading(false);
         if (res.ok) return;
         if (res.code === 'personal_qr_not_supported') {
            setNotTaken(true);
            return setQrError("This QR can't be used yet.");
         }
         setQrError(res.error ?? "Couldn't read that QR. Try again.");
      },
      [decode]
   );

   const onPhoto = async (file: File | undefined) => {
      if (!file) return;
      setReading(true);
      setQrError('');
      setNotTaken(false);
      const text = await readQrFromImage(file);
      if (text) return void read(text);
      setReading(false);
      setQrError('No QR in that picture. Try a clearer screenshot.');
   };

   // ── Step 1: add your QR. One card: what it looks like, 3 short lines, one gold button. ──
   if (!hasQr) {
      return (
         <div className="flex flex-col gap-4 pb-6 text-[#2b2116] dark:text-[#f5efe3]">
            <QrTrail step={0} />
            <StepHead image="/hippos/connect/code-copied.png" title="Add your bank's QR" subtitle="Pesos go straight to your bank." />
            <Card>
               {scanning ? (
                  <CameraView onCode={read} onClose={() => setScanning(false)} />
               ) : (
                  <>
                     <div className="flex items-center gap-4">
                        <figure className="w-[104px] shrink-0">
                           <img
                              src="/cashout-guides/qr/example-qr.webp"
                              alt="Example of a bank QR"
                              width={104}
                              height={131}
                              className="w-full rounded-[12px] border-2 border-[#ecdfb8] bg-white dark:border-[#4a3d1c]"
                           />
                           <figcaption className="mt-1 text-center text-[12px] font-bold uppercase tracking-[0.04em] text-[#9a8a6a] dark:text-[#bfb29a]">
                              Example
                           </figcaption>
                        </figure>
                        <ol className="flex min-w-0 flex-1 flex-col gap-3">
                           {HOW.map((line, i) => (
                              <li key={line} className="flex items-center gap-2.5 text-[16px] font-bold leading-[20px]">
                                 <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#fff1c2] text-[14px] font-extrabold text-[#6b4a00] dark:bg-[#3a2e10] dark:text-[#ffe27a]">
                                    {i + 1}
                                 </span>
                                 {line}
                              </li>
                           ))}
                        </ol>
                     </div>
                     <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                           void onPhoto(e.target.files?.[0]);
                           e.target.value = '';
                        }}
                     />
                     {reading ? (
                        <p className="flex items-center justify-center gap-2 py-3 text-[16px] font-bold text-[#6b4a00] dark:text-[#ffd36b]">
                           <Loader2 aria-hidden="true" className="size-5 animate-spin" strokeWidth={3} /> Reading your QR…
                        </p>
                     ) : (
                        <>
                           <GoldButton onClick={() => fileRef.current?.click()}>
                              <ImageUp aria-hidden="true" className="size-5" strokeWidth={2.6} /> Upload my QR
                           </GoldButton>
                           <SoftButton onClick={() => setScanning(true)}>
                              <Camera aria-hidden="true" className="size-5" /> Scan with camera
                           </SoftButton>
                        </>
                     )}
                     {qrError ? (
                        <div className="flex flex-col gap-2 rounded-[14px] bg-[#fff1f0] px-3 py-3 dark:bg-[#3a1614]">
                           <p className="text-center text-[15px] font-bold text-[#c0392b] dark:text-[#ff8a7a]">{qrError}</p>
                           {notTaken && onUseBank ? <SoftButton onClick={onUseBank}>Use my account number instead</SoftButton> : null}
                        </div>
                     ) : null}
                     <button
                        type="button"
                        onClick={() => setShowHelp((v) => !v)}
                        aria-expanded={showHelp}
                        className="flex min-h-[44px] items-center justify-center gap-1 text-[15px] font-bold text-[#6b55f7] dark:text-[#b3a6ff]"
                     >
                        Where is my QR?
                        <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${showHelp ? 'rotate-180' : ''}`} strokeWidth={3} />
                     </button>
                     {showHelp ? (
                        <div className="grid grid-cols-2 gap-3">
                           {HELP_PICTURES.map((pic) => (
                              <figure key={pic.img}>
                                 <img src={pic.img} alt="" className="aspect-[10/7] w-full rounded-[12px] bg-[#fff4d6] object-cover dark:bg-[#2a2335]" />
                                 <figcaption className="mt-1.5 text-center text-[14px] font-bold leading-[18px]">{pic.text}</figcaption>
                              </figure>
                           ))}
                           <p className="col-span-2 text-center text-[14px] leading-[19px] text-[#7a6a4f] dark:text-[#bfb29a]">
                              It must be your own QR, in your name.
                           </p>
                        </div>
                     ) : null}
                  </>
               )}
            </Card>
         </div>
      );
   }

   // ── Step 2: how many pesos ──────────────────────────────────────
   const amountNum = Number(amount);
   const amountOk = amount !== '' && amountNum >= minPhp && amountNum <= maxPhp;
   const usdcNeeded = amountNum > 0 && phpPerUsdc > 0 ? (amountNum / phpPerUsdc) * (1 + FEE_SHARE) : 0;
   const tooMuch = spendable != null && usdcNeeded > spendable;
   const maxPesos = spendable != null && phpPerUsdc > 0 ? Math.min(maxPhp, Math.floor((spendable * phpPerUsdc) / (1 + FEE_SHARE))) : null;
   return (
      <div className="flex flex-col gap-4 pb-6 text-[#2b2116] dark:text-[#f5efe3]">
         <QrTrail step={1} />
         <DoneRow>
            <span className="flex items-center gap-2">
               <QrCode aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.6} />
               <span className="min-w-0 truncate">{qrName || 'Your QR'}</span>
               <button type="button" onClick={onClearQr} className="ml-auto shrink-0 text-[14px] font-semibold underline opacity-75">
                  Change
               </button>
            </span>
         </DoneRow>
         <StepHead image="/hippos/hippo-wallet.png" title="How many pesos?" />
         <Card className="items-center !gap-2 py-5 text-center">
            <div className="flex min-h-[64px] w-full items-center rounded-[14px] border-2 border-[#ecdfb8] bg-white px-4 dark:border-[#4a3d1c] dark:bg-[#1a1524]">
               <span className="text-[30px] font-extrabold text-[#7a6a4f] dark:text-[#bfb29a]">₱</span>
               <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, '').replace(/(\.\d{0,2}).*/, '$1'))}
                  placeholder="0"
                  aria-label="Amount in pesos"
                  className="min-w-0 flex-1 bg-transparent pl-2 text-[34px] font-extrabold outline-none"
               />
               {maxPesos != null && maxPesos >= minPhp ? (
                  <button
                     type="button"
                     onClick={() => setAmount(String(maxPesos))}
                     className="min-h-[44px] rounded-[12px] bg-[#fff1c2] px-3 text-[15px] font-extrabold text-[#6b4a00] dark:bg-[#3a2e10] dark:text-[#ffe27a]"
                  >
                     All
                  </button>
               ) : null}
            </div>
            <span className="text-[15px] font-semibold text-[#7a6a4f] dark:text-[#bfb29a]">
               {usdcNeeded > 0 ? `≈ ${usdcNeeded.toFixed(2)} USDC with fees` : `${peso(minPhp)} to ${peso(maxPhp)}`}
               {spendable != null ? ` · you have ${spendable} USDC` : ''}
            </span>
            {amount !== '' && !amountOk ? (
               <span className="text-[15px] font-bold text-[#c0392b]">
                  {amountNum < minPhp ? `At least ${peso(minPhp)}.` : `Up to ${peso(maxPhp)} for now.`}
               </span>
            ) : tooMuch ? (
               <span className="text-[15px] font-bold text-[#c0392b]">More than you have.</span>
            ) : null}
            {error ? <span className="text-[15px] font-bold text-[#c0392b] dark:text-[#ff8a7a]">{error}</span> : null}
         </Card>
         <GoldButton busy={busy} disabled={!amountOk || tooMuch || spendable == null} onClick={onGetPrice}>
            {busy ? 'One moment…' : 'Get my price'}
         </GoldButton>
      </div>
   );
}
