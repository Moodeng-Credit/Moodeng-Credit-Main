import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Video } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { clarityEvent } from '@/lib/analytics/clarity';
import {
   callCountdownLabel,
   chomp,
   type ChompState,
   COLS,
   type Dir,
   moveHippo,
   newWave,
   ROWS,
   sharkStepMs,
   stepSharks
} from '@/lib/sharkChomp';

// moodeng.app/chomp — Shark Chomp, a little game for while they wait for their call. Public (the
// 30 / 15-minute reminders open it from Messenger, often signed out). Optional query:
//   ?at=ISO     the call's start → "Your call starts in 12 min" bar, and a Join screen at start time
//   ?join=URL   the call's Zoom link for that Join button (only zoom.us links are used)

const HIPPO_IMG = '/shark-fighter/stamp-1.webp';
const HERO_IMG = '/shark-fighter/fighter-moodeng.webp';
const BEST_KEY = 'md_chomp_best';
const MOVE_REPEAT_MS = 150;

const readBest = (): number => {
   try {
      return Number(window.localStorage.getItem(BEST_KEY) ?? 0) || 0;
   } catch {
      return 0;
   }
};
const saveBest = (n: number) => {
   try {
      window.localStorage.setItem(BEST_KEY, String(n));
   } catch {
      /* private mode: the best score just isn't kept */
   }
};

const safeJoinUrl = (raw: string | null): string | null => {
   if (!raw) return null;
   try {
      const u = new URL(raw);
      return u.protocol === 'https:' && (u.hostname === 'zoom.us' || u.hostname.endsWith('.zoom.us')) ? u.toString() : null;
   } catch {
      return null;
   }
};

type Phase = 'intro' | 'playing' | 'over';

export default function SharkChompPage() {
   const [params] = useSearchParams();
   const callAt = params.get('at');
   const joinUrl = safeJoinUrl(params.get('join'));

   const canvasRef = useRef<HTMLCanvasElement | null>(null);
   const boxRef = useRef<HTMLDivElement | null>(null);
   const stateRef = useRef<ChompState>(newWave(1, Math.random));
   const lastSharkStep = useRef(0);
   const heldDir = useRef<Dir | null>(null);
   const heldTimer = useRef<number | null>(null);
   const hippoImg = useRef<HTMLImageElement | null>(null);
   const swipeStart = useRef<{ x: number; y: number } | null>(null);

   const [phase, setPhase] = useState<Phase>('intro');
   const [hud, setHud] = useState({ score: 0, hearts: 3, wave: 1, reach: 2 });
   const [best, setBest] = useState(0);
   const [now, setNow] = useState(() => Date.now());
   const [tile, setTile] = useState(28);
   const [callDismissed, setCallDismissed] = useState(false);

   const callLabel = callCountdownLabel(callAt, now);
   const callStarting = Boolean(callAt) && !Number.isNaN(Date.parse(callAt ?? '')) && now >= Date.parse(callAt ?? '');
   const showCallScreen = callStarting && !callDismissed;

   useEffect(() => {
      setBest(readBest());
      const img = new Image();
      img.src = HIPPO_IMG;
      hippoImg.current = img;
      const t = window.setInterval(() => setNow(Date.now()), 15_000);
      return () => window.clearInterval(t);
   }, []);

   // Fit the lagoon to the phone's width (and keep it from being taller than the screen).
   useEffect(() => {
      const fit = () => {
         const w = boxRef.current?.clientWidth ?? 320;
         // Room left after the bars above (~150px) and the controls below (~190px), so the whole game fits on one phone screen.
         const maxH = Math.max(ROWS * 18, window.innerHeight - 340);
         setTile(Math.max(18, Math.floor(Math.min(w / COLS, maxH / ROWS))));
      };
      fit();
      window.addEventListener('resize', fit);
      return () => window.removeEventListener('resize', fit);
   }, []);

   const sync = useCallback(() => {
      const s = stateRef.current;
      setHud({ score: s.score, hearts: s.hearts, wave: s.wave, reach: s.reach });
      if (s.over) {
         setPhase('over');
         if (s.score > readBest()) {
            saveBest(s.score);
            setBest(s.score);
         }
         clarityEvent('chomp_game_over');
      }
   }, []);

   const draw = useCallback(() => {
      const c = canvasRef.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      const s = stateRef.current;
      const t = tile;
      const dpr = window.devicePixelRatio || 1;
      if (c.width !== COLS * t * dpr) {
         c.width = COLS * t * dpr;
         c.height = ROWS * t * dpr;
         c.style.width = `${COLS * t}px`;
         c.style.height = `${ROWS * t}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const at = Date.now();
      ctx.fillStyle = '#bfe6fb';
      ctx.fillRect(0, 0, COLS * t, ROWS * t);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${Math.floor(t * 0.72)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      for (let y = 0; y < ROWS; y++) {
         for (let x = 0; x < COLS; x++) {
            const cell = s.grid[y][x];
            const px = x * t;
            const py = y * t;
            if ((x + y) % 2 === 0 && cell !== 'rock') {
               ctx.fillStyle = '#b3dff7';
               ctx.fillRect(px, py, t, t);
            }
            if (cell === 'rock') {
               ctx.fillStyle = '#8e86a3';
               ctx.beginPath();
               ctx.roundRect(px + 1, py + 1, t - 2, t - 2, t * 0.28);
               ctx.fill();
               ctx.fillStyle = '#a39bb8';
               ctx.beginPath();
               ctx.roundRect(px + 3, py + 3, t - 8, t * 0.4, t * 0.2);
               ctx.fill();
            } else if (cell === 'weed') ctx.fillText('🌿', px + t / 2, py + t / 2 + 1);
            else if (cell === 'melon') ctx.fillText('🍉', px + t / 2, py + t / 2 + 1);
            else if (cell === 'heart') ctx.fillText('❤️', px + t / 2, py + t / 2 + 1);
         }
      }
      // The bite's flash.
      if (at - s.lastChompAt < 180) {
         ctx.fillStyle = 'rgba(255, 207, 64, 0.55)';
         for (const p of s.chompTiles) {
            ctx.beginPath();
            ctx.roundRect(p.x * t + 2, p.y * t + 2, t - 4, t - 4, t * 0.3);
            ctx.fill();
         }
      }
      for (const k of s.sharks) {
         ctx.save();
         ctx.translate(k.x * t + t / 2, k.y * t + t / 2 + 1);
         if (k.dir === 'right') ctx.scale(-1, 1); // the emoji faces left
         ctx.fillText('🦈', 0, 0);
         ctx.restore();
      }
      const blink = at < s.invulnerableUntil && Math.floor(at / 120) % 2 === 0;
      if (!blink) {
         const img = hippoImg.current;
         const hx = s.hippo.x * t;
         const hy = s.hippo.y * t;
         if (img?.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(hx + t / 2, hy + t / 2, t * 0.48, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(img, hx, hy, t, t);
            ctx.restore();
         } else ctx.fillText('🦛', hx + t / 2, hy + t / 2 + 1);
         // Which way she'll bite.
         const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[s.facing];
         ctx.fillStyle = '#ffb703';
         ctx.beginPath();
         ctx.arc(hx + t / 2 + d[0] * t * 0.5, hy + t / 2 + d[1] * t * 0.5, t * 0.11, 0, Math.PI * 2);
         ctx.fill();
      }
   }, [tile]);

   // The loop: sharks swim on their own clock; everything is redrawn every frame.
   useEffect(() => {
      let raf = 0;
      const loop = () => {
         const at = Date.now();
         if (phase === 'playing' && !showCallScreen) {
            const s = stateRef.current;
            if (at - lastSharkStep.current >= sharkStepMs(s.wave)) {
               lastSharkStep.current = at;
               const next = stepSharks(s, at, Math.random);
               if (next !== s) {
                  stateRef.current = next;
                  if (next.hearts !== s.hearts) sync();
               }
            }
         }
         draw();
         raf = window.requestAnimationFrame(loop);
      };
      raf = window.requestAnimationFrame(loop);
      return () => window.cancelAnimationFrame(raf);
   }, [phase, draw, sync, showCallScreen]);

   const active = phase === 'playing' && !showCallScreen;

   const move = useCallback(
      (dir: Dir) => {
         if (!active) return;
         stateRef.current = moveHippo(stateRef.current, dir, Date.now());
         sync();
      },
      [active, sync]
   );

   const bite = useCallback(() => {
      if (!active) return;
      const before = stateRef.current;
      stateRef.current = chomp(before, Date.now(), Math.random);
      if (stateRef.current.wave !== before.wave) clarityEvent('chomp_wave_cleared');
      sync();
   }, [active, sync]);

   const start = () => {
      stateRef.current = newWave(1, Math.random);
      lastSharkStep.current = Date.now();
      setPhase('playing');
      sync();
      clarityEvent('chomp_game_start');
   };

   // Keyboard (desktop): arrows / WASD move, space or enter chomps.
   useEffect(() => {
      const keys: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
      const onKey = (e: KeyboardEvent) => {
         if (keys[e.key]) {
            e.preventDefault();
            move(keys[e.key]);
         } else if (e.key === ' ' || e.key === 'Enter') {
            if (!active) return;
            e.preventDefault();
            bite();
         }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
   }, [move, bite, active]);

   // D-pad: one step on press, then keep swimming while held.
   const stopHold = () => {
      heldDir.current = null;
      if (heldTimer.current) window.clearInterval(heldTimer.current);
      heldTimer.current = null;
   };
   const startHold = (dir: Dir) => (e: ReactPointerEvent) => {
      e.preventDefault();
      stopHold();
      heldDir.current = dir;
      move(dir);
      heldTimer.current = window.setInterval(() => heldDir.current && move(heldDir.current), MOVE_REPEAT_MS);
   };
   useEffect(() => stopHold, []);

   // On the lagoon itself: swipe to swim, tap to chomp.
   const onBoardDown = (e: ReactPointerEvent) => {
      swipeStart.current = { x: e.clientX, y: e.clientY };
   };
   const onBoardUp = (e: ReactPointerEvent) => {
      const s0 = swipeStart.current;
      swipeStart.current = null;
      if (!s0) return;
      const dx = e.clientX - s0.x;
      const dy = e.clientY - s0.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return bite();
      move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
   };

   const padBtn = (dir: Dir, Icon: typeof ArrowUp, label: string) => (
      <button
         aria-label={label}
         className="flex size-[50px] touch-none select-none items-center justify-center rounded-2xl bg-white text-[#6b55f7] shadow-[0_4px_0_#d8cffc] active:translate-y-[2px] active:shadow-[0_2px_0_#d8cffc]"
         onPointerCancel={stopHold}
         onPointerDown={startHold(dir)}
         onPointerLeave={stopHold}
         onPointerUp={stopHold}
         type="button"
      >
         <Icon aria-hidden="true" className="size-7" strokeWidth={2.6} />
      </button>
   );

   return (
      <main className="flex min-h-[100dvh] flex-col items-center bg-[#f8f1ff] px-4 pb-4 pt-3 text-[#594d65]">
         <div className="flex w-full max-w-[440px] flex-col items-center gap-2" ref={boxRef}>
            {callLabel ? (
               <div className="flex w-full items-center justify-between gap-2 rounded-full bg-white px-4 py-2 text-[14px] font-semibold shadow-sm">
                  <span>⏰ {callLabel}</span>
                  {joinUrl ? (
                     <a className="flex items-center gap-1 text-[#6b55f7]" href={joinUrl} rel="noreferrer" target="_blank">
                        <Video aria-hidden="true" className="size-4" /> Join
                     </a>
                  ) : null}
               </div>
            ) : null}

            <div className="flex w-full items-center justify-between text-[15px] font-bold">
               <span>🦈 Shark Chomp</span>
               <span className="flex gap-3">
                  <span aria-label={`${hud.hearts} hearts`}>{'❤️'.repeat(Math.max(0, hud.hearts))}</span>
                  <span>🍉{hud.reach}</span>
               </span>
            </div>
            <div className="flex w-full justify-between text-[13px] text-[#7b6b8c]">
               <span>Wave {hud.wave}</span>
               <span>Score {hud.score}</span>
               <span>Best {Math.max(best, hud.score)}</span>
            </div>

            <div className="relative overflow-hidden rounded-[18px] border-4 border-[#7661f9] shadow-[0_8px_24px_rgba(107,85,247,0.25)]">
               <canvas className="block touch-none" onPointerDown={onBoardDown} onPointerUp={onBoardUp} ref={canvasRef} />

               {phase !== 'playing' || showCallScreen ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#f8f1ffee] px-5 text-center">
                     {showCallScreen ? (
                        <>
                           <span className="text-[22px] font-bold">Your call is starting! 🎥</span>
                           <span className="text-[15px]">Have your ID ready and video on.</span>
                           {joinUrl ? (
                              <a
                                 className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#ffb703] text-[17px] font-bold text-[#3b2a00] shadow-[0_6px_16px_rgba(255,183,3,0.4)]"
                                 href={joinUrl}
                                 onClick={() => clarityEvent('chomp_join_call')}
                                 rel="noreferrer"
                                 target="_blank"
                              >
                                 <Video aria-hidden="true" className="size-5" /> Join the call now
                              </a>
                           ) : (
                              <span className="text-[15px] font-semibold">Open the Zoom link we sent you on Messenger.</span>
                           )}
                           <button className="text-[14px] font-semibold text-[#7b6b8c]" onClick={() => setCallDismissed(true)} type="button">
                              I&apos;m already in the call
                           </button>
                        </>
                     ) : phase === 'intro' ? (
                        <>
                           <img alt="Moodeng the hippo chasing off a shark" className="h-[42%] w-auto object-contain" src={HERO_IMG} />
                           <span className="text-[22px] font-bold">Chomp the sharks!</span>
                           <span className="text-[14px] leading-snug">
                              Swipe or use the arrows to swim. Tap to <b>CHOMP</b> the way you face. Don&apos;t let a shark touch you!
                           </span>
                           <button className="min-h-[48px] w-full rounded-full bg-[#ffb703] text-[17px] font-bold text-[#3b2a00] shadow-[0_6px_16px_rgba(255,183,3,0.4)]" onClick={start} type="button">
                              Play
                           </button>
                        </>
                     ) : (
                        <>
                           <span className="text-[24px] font-bold">Game over!</span>
                           <span className="text-[16px]">
                              Score <b>{hud.score}</b> · Wave {hud.wave}
                           </span>
                           {hud.score >= best && hud.score > 0 ? <span className="text-[15px] font-semibold text-[#2f7a3a]">🎉 New best!</span> : null}
                           <button className="min-h-[48px] w-full rounded-full bg-[#ffb703] text-[17px] font-bold text-[#3b2a00] shadow-[0_6px_16px_rgba(255,183,3,0.4)]" onClick={start} type="button">
                              Play again
                           </button>
                        </>
                     )}
                  </div>
               ) : null}
            </div>

            <div className="flex w-full items-center justify-between gap-3 pt-1">
               <div className="grid grid-cols-3 grid-rows-3 gap-1">
                  <span />
                  {padBtn('up', ArrowUp, 'Swim up')}
                  <span />
                  {padBtn('left', ArrowLeft, 'Swim left')}
                  <span />
                  {padBtn('right', ArrowRight, 'Swim right')}
                  <span />
                  {padBtn('down', ArrowDown, 'Swim down')}
                  <span />
               </div>
               <button
                  className="flex size-[100px] touch-none select-none flex-col items-center justify-center rounded-full bg-[#ffb703] text-[18px] font-black text-[#3b2a00] shadow-[0_6px_0_#d99a00] active:translate-y-[3px] active:shadow-[0_3px_0_#d99a00]"
                  onPointerDown={(e) => {
                     e.preventDefault();
                     bite();
                  }}
                  type="button"
               >
                  <span className="text-[34px] leading-none">🦛</span>
                  CHOMP
               </button>
            </div>
         </div>
      </main>
   );
}
