import { useEffect, useMemo, useRef, useState } from 'react';

import { Gift, Loader2, Lock, Sparkles } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import BrandedVideo from '@/components/BrandedVideo';

import { useAnswerSpinCampaign, useRefreshSpinState, useSpinState, useSpinWheel } from '@/hooks/useSpinWheel';

import { EXTERNAL_LINKS } from '@/config/externalLinks';
import {
   BLOCKED_TEXT,
   earnGameSpin,
   GAME_SPIN_TEXT,
   PRIZE_HEADLINE,
   SLICE_DEG,
   type SpinCampaign,
   SpinError,
   type SpinPrize,
   type SpinResult,
   type SpinState,
   type SpinWin,
   targetRotation,
   WHEEL_SLICES
} from '@/lib/spinWheel';
import { playSuccess } from '@/lib/uiSounds';
import { VoucherClaimPopup } from '@/views/dashboard-v2/DashboardV2Rewards';
import { ConfettiRain, CONNECT_HIPPOS } from '@/views/dashboard/components/connectKit';
import { GoldButton, GoldLink } from '@/views/indonesia/ui';

// moodeng.app/spin and moodeng.app/spin/CODE — Moo-Spin, the prize wheel.
//   /spin/CODE  a Facebook post / video the team made in Admin → Spin wheel: read or watch it, answer
//               its question → one spin. Messenger "SPIN" replies with this link.
//   /spin       the wheel with whatever spins they have (everyone approved gets a welcome spin).
// The server draws the prize (spin_wheel); the wheel only animates to it. Prizes are claimed with the
// usual Moo-Menu popup (VoucherClaimPopup → claim_spin_prize).

const SPIN_MS = 4600;
const ZONE = 'Asia/Manila';

const whenLabel = (iso: string) =>
   new Intl.DateTimeFormat('en-PH', { timeZone: ZONE, weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const dayLabel = (iso: string) =>
   new Intl.DateTimeFormat('en-PH', { timeZone: ZONE, month: 'short', day: 'numeric' }).format(new Date(iso));

const youtubeId = (url: string | null): string | null => {
   if (!url) return null;
   const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);
   return match ? match[1] : null;
};

/** Cash slices go grey when this week's pot has none left (team test spins ignore the pot). */
const soldOut = (prize: SpinPrize, state: SpinState | undefined) => {
   if (!state || state.test) return false;
   if (prize === 'grab100') return state.potLeft.grab100 <= 0;
   if (prize === 'food50') return state.potLeft.food50 <= 0;
   if (prize === 'locked50') return state.potLeft.locked50 <= 0;
   return false;
};

function Wheel({ rotation, spinning, state }: { rotation: number; spinning: boolean; state: SpinState | undefined }) {
   const r = 150;
   const point = (deg: number, radius: number) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      return [160 + radius * Math.cos(rad), 160 + radius * Math.sin(rad)];
   };
   return (
      <div className="relative mx-auto aspect-square w-full max-w-[320px]">
         {/* Pointer at 12 o'clock. */}
         <div
            aria-hidden="true"
            className="absolute left-1/2 top-[-6px] z-10 h-0 w-0 -translate-x-1/2 border-x-[14px] border-t-[26px] border-x-transparent border-t-[#d51728] drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]"
         />
         <svg
            viewBox="0 0 320 320"
            className="h-full w-full drop-shadow-[0_10px_24px_rgba(107,85,247,0.28)]"
            style={{
               transform: `rotate(${rotation}deg)`,
               transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.72, 0.12, 1)` : 'none'
            }}
            role="img"
            aria-label="Prize wheel"
         >
            <circle cx="160" cy="160" r="158" fill="#ffd84d" />
            {WHEEL_SLICES.map((slice, index) => {
               const start = index * SLICE_DEG;
               const end = start + SLICE_DEG;
               const [x1, y1] = point(start, r);
               const [x2, y2] = point(end, r);
               const [tx, ty] = point(start + SLICE_DEG / 2, r * 0.64);
               const out = soldOut(slice.prize, state);
               return (
                  <g key={index}>
                     <path
                        d={`M160,160 L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`}
                        fill={out ? '#d9d4e2' : slice.fill}
                        stroke="#fff"
                        strokeWidth="3"
                     />
                     <g transform={`rotate(${start + SLICE_DEG / 2} ${tx} ${ty})`}>
                        <text x={tx} y={ty - 2} textAnchor="middle" fontSize="24" fontWeight="900" fill={out ? '#8f879c' : slice.ink}>
                           {slice.label}
                        </text>
                        <text x={tx} y={ty + 17} textAnchor="middle" fontSize="12" fontWeight="700" fill={out ? '#8f879c' : slice.ink}>
                           {out ? 'Sold out' : slice.sub}
                        </text>
                     </g>
                  </g>
               );
            })}
            <circle cx="160" cy="160" r="30" fill="#fff" stroke="#ffd84d" strokeWidth="6" />
            <text x="160" y="168" textAnchor="middle" fontSize="22">
               🦛
            </text>
         </svg>
      </div>
   );
}

function CampaignCard({ campaign }: { campaign: SpinCampaign }) {
   const answer = useAnswerSpinCampaign();
   const videoId = youtubeId(campaign.videoUrl);
   const [watched, setWatched] = useState(!videoId);
   const [wrong, setWrong] = useState(false);

   const send = (index: number | null) => {
      setWrong(false);
      answer.mutate(
         { code: campaign.code, answer: index },
         { onSuccess: (result) => !result.ok && result.error === 'wrong_answer' && setWrong(true) }
      );
   };

   if (campaign.done) {
      return (
         <div className="rounded-[20px] border-2 border-[#d6f0da] bg-[#f1fbf2] px-4 py-3 text-center text-[15px] font-semibold text-[#3c8248] dark:border-[#24452a] dark:bg-[#12261a] dark:text-[#7fd68b]">
            ✓ You got your spin for “{campaign.title}”
         </div>
      );
   }

   return (
      <div className="flex flex-col gap-3 rounded-[24px] bg-white p-4 shadow-[0_2px_10px_rgba(80,60,120,0.12)] dark:bg-[#1b1428]">
         <p className="text-[13px] font-bold uppercase tracking-wide text-[#6b55f7]">Read, then spin</p>
         <h2 className="text-[20px] font-extrabold leading-6 text-[#3b2f4a] dark:text-[#f5f0ff]">{campaign.title}</h2>
         {campaign.body ? (
            <p className="whitespace-pre-line text-[16px] leading-[22px] text-[#45556c] dark:text-[#cbbfdc]">{campaign.body}</p>
         ) : null}
         {videoId ? (
            <BrandedVideo videoId={videoId} tall={false} onEnded={() => setWatched(true)} onBroken={() => setWatched(true)} />
         ) : campaign.videoUrl ? (
            <a
               href={campaign.videoUrl}
               target="_blank"
               rel="noreferrer"
               className="text-center text-[16px] font-bold text-[#6b55f7] underline underline-offset-4"
            >
               ▶ Watch the video
            </a>
         ) : null}
         {!watched ? (
            <p className="text-center text-[14px] text-[#7b6b8c]">Watch to the end to get your spin.</p>
         ) : campaign.question ? (
            <div className="flex flex-col gap-2">
               <p className="text-[17px] font-bold text-[#3b2f4a] dark:text-[#f5f0ff]">{campaign.question}</p>
               {campaign.options.map((option, index) => (
                  <button
                     key={index}
                     type="button"
                     disabled={answer.isPending}
                     onClick={() => send(index)}
                     className="min-h-[52px] rounded-[16px] border-2 border-[#7661f9] bg-[#f8f1ff] px-4 text-left text-[16px] font-semibold text-[#3b2f4a] transition active:scale-[0.98] disabled:opacity-60 dark:bg-[#241a36] dark:text-[#f5f0ff]"
                  >
                     {option}
                  </button>
               ))}
               {wrong ? (
                  <p className="text-[14px] font-semibold text-[#d51728]" role="alert">
                     Not quite. Read it again and try once more.
                  </p>
               ) : null}
            </div>
         ) : (
            <GoldButton busy={answer.isPending} onClick={() => send(null)}>
               Get my spin
            </GoldButton>
         )}
      </div>
   );
}

function ResultSheet({ result, onClaim, onClose }: { result: SpinResult; onClaim: () => void; onClose: () => void }) {
   const win = result.prize === 'grab100' || result.prize === 'food50';
   const text = result.test
      ? 'Team test spin: nothing is sent.'
      : result.prize === 'grab100'
        ? 'GrabMart or 2 food links. Claim it in the next 14 days.'
        : result.prize === 'food50'
          ? 'Jollibee & more. Claim it in the next 14 days.'
          : result.prize === 'locked50'
            ? 'It unlocks when your next loan is repaid on time.'
            : result.prize === 'extra'
              ? `Your next spin opens ${result.nextAt ? whenLabel(result.nextAt) : 'tomorrow'}.`
              : 'Watch our Facebook page for your next spin.';
   return (
      <div
         className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 px-4 pb-6 sm:items-center"
         role="dialog"
         aria-modal="true"
      >
         {win || result.prize === 'locked50' ? <ConfettiRain /> : null}
         <div className="w-full max-w-[400px] rounded-[26px] bg-gradient-to-b from-[#fff6c2] via-white to-white px-5 pb-5 pt-4 text-center dark:from-[#3a3216] dark:via-[#1b1428] dark:to-[#1b1428]">
            <img
               src={result.prize === 'none' ? CONNECT_HIPPOS.missed : CONNECT_HIPPOS.approved}
               alt=""
               className="mx-auto h-28 w-28 object-contain"
            />
            <p className="text-[26px] font-black leading-8 text-[#3b2f4a] dark:text-[#f5f0ff]">{PRIZE_HEADLINE[result.prize]}</p>
            <p className="mt-1 text-[16px] leading-[22px] text-[#45556c] dark:text-[#cbbfdc]">{text}</p>
            <div className="mt-4">
               {win && !result.test ? (
                  <GoldButton onClick={onClaim}>Claim my ₱{result.amountPhp}</GoldButton>
               ) : (
                  <GoldButton onClick={onClose}>OK</GoldButton>
               )}
            </div>
            {win && !result.test ? (
               <button type="button" onClick={onClose} className="mt-3 text-[14px] font-semibold text-[#6b55f7]">
                  Later
               </button>
            ) : null}
         </div>
      </div>
   );
}

function PrizeRow({ win, onClaim }: { win: SpinWin; onClaim: () => void }) {
   const name = win.prize === 'grab100' ? '₱100 voucher' : win.prize === 'locked50' ? '₱50 food (next loan)' : '₱50 food';
   return (
      <li className="flex items-center gap-3 rounded-[16px] bg-white px-3 py-2.5 shadow-[0_1px_4px_rgba(80,60,120,0.12)] dark:bg-[#1b1428]">
         <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#fff3c4] text-[#5a3a12]">
            {win.status === 'locked' ? <Lock className="size-5" /> : <Gift className="size-5" />}
         </span>
         <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold text-[#3b2f4a] dark:text-[#f5f0ff]">{name}</span>
            <span className="block text-[13px] text-[#7b6b8c]">
               {win.status === 'claimable'
                  ? win.expiresAt && win.prize !== 'locked50'
                     ? `Claim by ${dayLabel(win.expiresAt)}`
                     : 'Ready to claim'
                  : win.status === 'locked'
                    ? 'Repay your next loan on time'
                    : win.status === 'claimed'
                      ? 'Claimed ✓'
                      : win.status === 'test'
                        ? 'Team test'
                        : 'Expired'}
            </span>
         </span>
         {win.status === 'claimable' ? (
            <button
               type="button"
               onClick={onClaim}
               className="rounded-full px-4 py-2 text-[15px] font-extrabold text-[#4a2a00]"
               style={{ backgroundImage: 'linear-gradient(180deg, #ffe36b 0%, #ffc21a 100%)' }}
            >
               Claim
            </button>
         ) : null}
      </li>
   );
}

export default function SpinPage({ sample }: { sample?: SpinState } = {}) {
   const { code: rawCode } = useParams();
   const code = rawCode
      ? rawCode
           .toUpperCase()
           .replace(/[^A-Z0-9]/g, '')
           .slice(0, 20)
      : null;
   const state = useSpinState(code, !sample);
   const refresh = useRefreshSpinState();
   // /spin?game=1: back from Shark Chomp (level 3) — save their one game spin, then show it.
   const [params] = useSearchParams();
   const fromGame = params.get('game') === '1' && !sample;
   const [gameNote, setGameNote] = useState<string | null>(null);
   const earned = useRef(false);
   useEffect(() => {
      if (!fromGame || earned.current) return;
      earned.current = true;
      earnGameSpin()
         .then((r) => {
            setGameNote(GAME_SPIN_TEXT[r.saved ? 'saved' : r.had ? 'had' : (r.reason ?? 'no_call')]);
            try {
               if (r.saved || r.had) window.localStorage.setItem('md_chomp_spin', 'saved');
            } catch {
               /* private mode */
            }
            refresh();
         })
         .catch(() => setGameNote(null));
   }, [fromGame, refresh]);
   const spin = useSpinWheel();
   const [rotation, setRotation] = useState(0);
   const [spinning, setSpinning] = useState(false);
   const [result, setResult] = useState<SpinResult | null>(null);
   const [claiming, setClaiming] = useState<{ spinId: string; amountPhp: number } | null>(null);
   const [error, setError] = useState<string | null>(null);
   const timer = useRef<number | null>(null);
   const data = sample ?? state.data;

   const prizes = useMemo(() => (data?.prizes ?? []).filter((win) => win.status !== 'expired' || win.prize !== 'locked50'), [data]);

   const onSpin = () => {
      if (spinning || spin.isPending) return;
      setError(null);
      const land = (outcome: SpinResult) => {
         setSpinning(true);
         setRotation((now) => targetRotation(outcome.prize, now, Math.random()));
         if (timer.current) window.clearTimeout(timer.current);
         timer.current = window.setTimeout(() => {
            setSpinning(false);
            setResult(outcome);
            if (outcome.prize !== 'none') playSuccess();
            void refresh();
         }, SPIN_MS + 150);
      };
      if (sample) {
         const pool: SpinPrize[] = ['food50', 'locked50', 'extra', 'none'];
         const prize = pool[Math.floor(Math.random() * pool.length)];
         land({
            spinId: 'preview',
            prize,
            amountPhp: prize === 'food50' || prize === 'locked50' ? 50 : null,
            expiresAt: null,
            nextAt: null,
            test: false
         });
         return;
      }
      spin.mutate(undefined, {
         onSuccess: land,
         onError: (err) => {
            setError(
               err instanceof SpinError && err.message in BLOCKED_TEXT
                  ? BLOCKED_TEXT[err.message as keyof typeof BLOCKED_TEXT]
                  : 'Something went wrong. Try again.'
            );
            void refresh();
         }
      });
   };

   const headline = data?.welcomeReady
      ? 'Your welcome spin is ready!'
      : data && data.ready > 0
        ? `You have ${data.ready} spin${data.ready > 1 ? 's' : ''}!`
        : 'Moo-Spin';

   return (
      <main className="min-h-dvh bg-gradient-to-b from-[#f3ecff] via-[#faf7ff] to-white px-5 pb-10 pt-4 dark:from-[#211735] dark:via-[#171024] dark:to-[#100d17]">
         <div className="mx-auto flex w-full max-w-[420px] flex-col gap-4">
            <div className="flex items-end gap-2">
               <img src={CONNECT_HIPPOS.approved} alt="" className="h-[96px] w-[84px] shrink-0 object-contain" />
               <div className="mb-3 min-w-0">
                  <p className="flex items-center gap-1 text-[13px] font-bold uppercase tracking-wide text-[#6b55f7]">
                     <Sparkles className="size-4" /> Moo-Spin
                  </p>
                  <h1 className="text-[24px] font-black leading-7 text-[#3b2f4a] dark:text-[#f5f0ff]">{headline}</h1>
                  <p className="text-[14px] text-[#7b6b8c]">Free food prizes. No catch.</p>
               </div>
            </div>

            {!sample && state.isLoading ? (
               <div className="flex justify-center py-16">
                  <Loader2 className="size-8 animate-spin text-[#6b55f7]" />
               </div>
            ) : !data ? (
               <p className="rounded-[16px] bg-white p-4 text-center text-[16px] text-[#45556c]">
                  Couldn’t load Moo-Spin. Pull down to try again.
               </p>
            ) : data.blocked ? (
               <div className="flex flex-col gap-3 rounded-[24px] bg-white p-5 text-center shadow-[0_2px_10px_rgba(80,60,120,0.12)] dark:bg-[#1b1428]">
                  {gameNote ? <p className="text-[16px] font-bold text-[#2f7a3a]">{gameNote}</p> : null}
                  {data.gameSpin && (data.blocked === 'not_approved' || data.blocked === 'off') ? (
                     <p className="text-[18px] font-bold text-[#3b2f4a] dark:text-[#f5f0ff]">
                        {data.blocked === 'not_approved'
                           ? '🎟️ Your Shark Chomp spin is saved. It unlocks once you’re approved after your call.'
                           : '🎟️ Your Shark Chomp spin is saved. Moo-Spin opens soon, we’ll let you know!'}
                     </p>
                  ) : (
                     <p className="text-[18px] font-bold text-[#3b2f4a] dark:text-[#f5f0ff]">{BLOCKED_TEXT[data.blocked]}</p>
                  )}
                  {data.blocked === 'overdue' ? (
                     <GoldLink href="/repay">Repay now</GoldLink>
                  ) : (
                     <Link to="/dashboard" className="text-[16px] font-bold text-[#6b55f7]">
                        Back to Moodeng
                     </Link>
                  )}
               </div>
            ) : (
               <>
                  {gameNote ? (
                     <p className="rounded-[16px] bg-white px-4 py-3 text-center text-[16px] font-bold text-[#2f7a3a] dark:bg-[#1b1428]">{gameNote}</p>
                  ) : null}
                  {data.campaign ? <CampaignCard campaign={data.campaign} /> : null}
                  {data.campaignMissing ? (
                     <p className="rounded-[16px] bg-white px-4 py-3 text-center text-[15px] text-[#7b6b8c] dark:bg-[#1b1428]">
                        This post’s spin has ended. Watch our page for the next one!
                     </p>
                  ) : null}
                  {data.test ? (
                     <p className="rounded-[12px] bg-[#fff3c4] px-3 py-2 text-center text-[13px] font-semibold text-[#5a3a12]">
                        Team test mode: spins are practice, nothing is sent.
                     </p>
                  ) : null}

                  <Wheel rotation={rotation} spinning={spinning} state={data} />

                  {data.ready > 0 || spinning ? (
                     <GoldButton busy={spin.isPending || spinning} onClick={onSpin}>
                        {spinning ? 'Spinning…' : 'Spin!'}
                     </GoldButton>
                  ) : (
                     <div className="flex flex-col gap-2 rounded-[20px] bg-white p-4 text-center shadow-[0_1px_6px_rgba(80,60,120,0.12)] dark:bg-[#1b1428]">
                        <p className="text-[17px] font-bold text-[#3b2f4a] dark:text-[#f5f0ff]">
                           {data.nextAt ? `Next spin: ${whenLabel(data.nextAt)}` : 'No spins right now'}
                        </p>
                        <p className="text-[14px] text-[#7b6b8c]">Get spins from our Facebook posts. Send SPIN to our Page anytime.</p>
                        <GoldLink href={EXTERNAL_LINKS.support.messengerSpin} target="_blank" rel="noreferrer">
                           Message SPIN
                        </GoldLink>
                     </div>
                  )}
                  {error ? (
                     <p className="text-center text-[14px] font-semibold text-[#d51728]" role="alert">
                        {error}
                     </p>
                  ) : null}

                  {prizes.length ? (
                     <section className="flex flex-col gap-2">
                        <h2 className="text-[17px] font-extrabold text-[#3b2f4a] dark:text-[#f5f0ff]">My prizes</h2>
                        <ul className="flex flex-col gap-2">
                           {prizes.map((win) => (
                              <PrizeRow key={win.id} win={win} onClaim={() => setClaiming({ spinId: win.id, amountPhp: win.amountPhp })} />
                           ))}
                        </ul>
                     </section>
                  ) : null}

                  <p className="text-center text-[12px] leading-4 text-[#9a8fab]">
                     Free to play. One cash prize per person every 30 days.
                     {data.test ? null : ` Left this week: ₱100 ×${data.potLeft.grab100}, ₱50 ×${data.potLeft.food50}.`}
                  </p>
               </>
            )}
         </div>

         {result ? (
            <ResultSheet
               result={result}
               onClose={() => setResult(null)}
               onClaim={() => {
                  setClaiming({ spinId: result.spinId, amountPhp: result.amountPhp ?? 0 });
                  setResult(null);
               }}
            />
         ) : null}
         {claiming ? (
            <VoucherClaimPopup
               voucher={{ reward: 'spin_win', friendReferralId: null, amountPhp: claiming.amountPhp, spinId: claiming.spinId }}
               isPreview={false}
               onClose={() => setClaiming(null)}
            />
         ) : null}
      </main>
   );
}
