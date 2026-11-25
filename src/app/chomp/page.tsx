import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';

import { Video } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { clarityEvent } from '@/lib/analytics/clarity';
import {
   applySnack,
   callCountdownLabel,
   nextLevel,
   SHOP,
   spinWheel,
   WHEEL,
   WHEEL_TOTAL,
   wheelDueAfter,
   type Food,
   FOOD_LIST,
   FOODS,
   isFood,
   lessonFor,
   chomp,
   type ChompState,
   COLS,
   type Dir,
   moveHippo,
   newWave,
   type Pos,
   ROWS,
   sharkStepMs,
   stepSharks
} from '@/lib/sharkChomp';

// moodeng.app/chomp — Shark Chomp, a little game for while they wait for their call. Public (the
// 30 / 15-minute reminders open it from Messenger, often signed out). Optional query:
//   ?at=ISO     the call's start → "Your call starts in 12 min" bar, and a Join screen at start time
//   ?join=URL   the call's Zoom link for that Join button (only zoom.us links are used)
//
// The rules are tile-based (src/lib/sharkChomp.ts); everything on screen glides between tiles, so
// Moodeng and the sharks move smoothly instead of jumping. Built for phones: full screen, a thumb
// joystick on the left, CHOMP on the right, no scrolling or zooming while playing.

const SPRITES = {
   run1: '/hippos/progress/hippo-jog.png',
   run2: '/hippos/progress/hippo-sprint.png',
   // Swimming down (toward you) / up (away): front and back walk frames (Gemini, 2026-11-25).
   front1: '/chomp/walk-front-a.webp',
   front2: '/chomp/walk-front-b.webp',
   back1: '/chomp/walk-back-a.webp',
   back2: '/chomp/walk-back-b.webp',
   // Her nom poses (made with Gemini from the Moodeng art, 2026-11-25): mouth open, then a happy munch.
   nomOpen: '/chomp/chomp-open.webp',
   nomMunch: '/chomp/chomp-munch.webp',
   // A cute-but-evil loan shark and the Filipino snacks hidden in the seaweed (Gemini, 2026-11-25).
   shark: '/chomp/shark.webp',
   pandesal: '/chomp/food-pandesal.webp',
   mango: '/chomp/food-mango.webp',
   halohalo: '/chomp/food-halohalo.webp',
   turon: '/chomp/food-turon.webp',
   hero: '/shark-fighter/fighter-moodeng.webp'
};
const BEST_KEY = 'md_chomp_best';
// One tile of swimming. Held input repeats on exactly this beat, so a held direction is one continuous glide.
const MOVE_MS = 165;
const STRIDE_MS = 130;
const JOY_DEAD = 14;

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

const buzz = (ms: number) => {
   try {
      navigator.vibrate?.(ms);
   } catch {
      /* no haptics */
   }
};

// A glide from one tile to the next.
type Glide = { from: Pos; to: Pos; start: number; dur: number };
const glideAt = (g: Glide, now: number): Pos => {
   const t = Math.min(1, Math.max(0, (now - g.start) / g.dur));
   return { x: g.from.x + (g.to.x - g.from.x) * t, y: g.from.y + (g.to.y - g.from.y) * t };
};
const moving = (g: Glide, now: number) => now - g.start < g.dur && (g.from.x !== g.to.x || g.from.y !== g.to.y);

// Little effects: the CHOMP! pop, eaten-shark poofs, the hit ring.
type Fx = { kind: 'chomp' | 'poof' | 'hit' | 'pickup'; at: Pos; start: number; text?: string; flip?: boolean };

// intro = the story; lesson = level 1's card; playing; house = Moodeng's House between levels; over.
type Phase = 'intro' | 'lesson' | 'playing' | 'house' | 'over';

const FOOD_FX: Record<Food, string> = {
   pandesal: 'Pandesal! Faster 💨',
   mango: 'Mango! Longer bite',
   halohalo: 'Halo-halo! Shield ✨',
   turon: 'Turon! +1 ❤️'
};
const FAST_MOVE_MS = 105;

// The story before the first level (George 2026-11-25: explain that loan sharks are bad).
const INTRO_SLIDES = [
   {
      img: '/chomp/shark.webp',
      title: 'Loan sharks are bad news',
      text: 'They lend fast, then add huge interest and threaten you when you’re late. Many families get stuck paying them for years.'
   },
   {
      img: '/hippos/body/hippo-body.webp',
      title: 'Moodeng is the fair way',
      text: 'Small loans, clear terms, real people. Pay on time and your limit grows. Now help Moodeng chase the sharks away!'
   }
] as const;

const useImages = () => {
   const ref = useRef<Record<keyof typeof SPRITES, HTMLImageElement> | null>(null);
   useEffect(() => {
      const imgs = {} as Record<keyof typeof SPRITES, HTMLImageElement>;
      (Object.keys(SPRITES) as Array<keyof typeof SPRITES>).forEach((k) => {
         const img = new Image();
         img.src = SPRITES[k];
         imgs[k] = img;
      });
      ref.current = imgs;
   }, []);
   return ref;
};

const ready = (img?: HTMLImageElement) => Boolean(img?.complete && img.naturalWidth > 0);

export default function SharkChompPage() {
   const [params] = useSearchParams();
   const callAt = params.get('at');
   const joinUrl = safeJoinUrl(params.get('join'));

   const canvasRef = useRef<HTMLCanvasElement | null>(null);
   const boardRef = useRef<HTMLDivElement | null>(null);
   const stateRef = useRef<ChompState>(newWave(1, Math.random));
   const imgs = useImages();

   const lastSharkStep = useRef(0);
   const hippoGlide = useRef<Glide>({ from: { x: 1, y: 1 }, to: { x: 1, y: 1 }, start: 0, dur: MOVE_MS });
   const sharkGlides = useRef(new Map<number, Glide>());
   const faceLeft = useRef(false);
   const lungeAt = useRef(0);
   const fx = useRef<Fx[]>([]);
   const heldDir = useRef<Dir | null>(null);
   const nextMoveAt = useRef(0);
   const joyOrigin = useRef<{ x: number; y: number; id: number } | null>(null);
   const [joyKnob, setJoyKnob] = useState<{ dx: number; dy: number } | null>(null);

   const [phase, setPhase] = useState<Phase>('intro');
   const [slide, setSlide] = useState(0);
   const [powers, setPowers] = useState({ fast: 0, shield: 0 });
   const [coins, setCoins] = useState(0);
   // Moodeng's House: power-ups bought (or won) for the next level, and the wheel.
   const [pending, setPending] = useState<Food[]>([]);
   const [wheel, setWheel] = useState<{ due: boolean; spun: number | null; angle: number }>({ due: false, spun: null, angle: 0 });
   const [hud, setHud] = useState({ score: 0, hearts: 3, wave: 1, reach: 2 });
   const [best, setBest] = useState(0);
   const [now, setNow] = useState(() => Date.now());
   const [tile, setTile] = useState(30);
   const [callDismissed, setCallDismissed] = useState(false);
   const [hidden, setHidden] = useState(false);

   // Local dev only: lets the screenshot script jump to a state (never in a production build).
   useEffect(() => {
      if (import.meta.env.DEV) (window as unknown as { __chomp?: unknown }).__chomp = { stateRef };
   }, []);

   const callLabel = callCountdownLabel(callAt, now);
   const callStartMs = callAt ? Date.parse(callAt) : NaN;
   const showCallScreen = !Number.isNaN(callStartMs) && now >= callStartMs && !callDismissed;
   const active = phase === 'playing' && !showCallScreen && !hidden;

   useEffect(() => {
      setBest(readBest());
      const t = window.setInterval(() => setNow(Date.now()), 15_000);
      const onVis = () => setHidden(document.hidden);
      document.addEventListener('visibilitychange', onVis);
      return () => {
         window.clearInterval(t);
         document.removeEventListener('visibilitychange', onVis);
      };
   }, []);

   // The page is a full-screen game: no scrolling, rubber-banding or pull-to-refresh behind it.
   useEffect(() => {
      const html = document.documentElement;
      const prev = { overflow: html.style.overflow, overscroll: html.style.overscrollBehavior, bodyOverflow: document.body.style.overflow };
      html.style.overflow = 'hidden';
      html.style.overscrollBehavior = 'none';
      document.body.style.overflow = 'hidden';
      return () => {
         html.style.overflow = prev.overflow;
         html.style.overscrollBehavior = prev.overscroll;
         document.body.style.overflow = prev.bodyOverflow;
      };
   }, []);

   // The lagoon takes whatever room is left between the bars and the controls.
   useEffect(() => {
      const el = boardRef.current;
      if (!el) return;
      const fit = () => setTile(Math.max(16, Math.floor(Math.min(el.clientWidth / COLS, el.clientHeight / ROWS))));
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(el);
      return () => ro.disconnect();
   }, []);

   const sync = useCallback(() => {
      const s = stateRef.current;
      setHud({ score: s.score, hearts: s.hearts, wave: s.wave, reach: s.reach });
      setPowers({ fast: s.fastUntil, shield: s.shieldUntil });
      setCoins(s.coins);
      if (s.over) {
         setPhase('over');
         heldDir.current = null;
         if (s.score > readBest()) {
            saveBest(s.score);
            setBest(s.score);
         }
         clarityEvent('chomp_game_over');
      }
   }, []);

   // New board (start or next wave): everyone appears where they are, no glide in from elsewhere.
   const snapAll = useCallback((s: ChompState, at: number) => {
      hippoGlide.current = { from: s.hippo, to: s.hippo, start: at, dur: MOVE_MS };
      sharkGlides.current = new Map(s.sharks.map((k) => [k.id, { from: { x: k.x, y: k.y }, to: { x: k.x, y: k.y }, start: at, dur: 1 }]));
      faceLeft.current = false;
   }, []);

   // Everything that follows a change of state, wherever it came from (a swim, a chomp, the sharks):
   // snack pop-ups, the hit ring, poofs for eaten sharks, and the lesson card when a level is cleared.
   const afterUpdate = useCallback(
      (before: ChompState, next: ChompState, at: number) => {
         if (next === before) return;
         stateRef.current = next;
         const where = next.hippo;
         if (next.hearts < before.hearts) {
            fx.current.push({ kind: 'hit', at: next.hippo, start: at });
            buzz(70);
         }
         // Which snack did she just eat? (Compare what each one changes.)
         const ate: Food | null =
            next.fastUntil > before.fastUntil ? 'pandesal' : next.shieldUntil > before.shieldUntil ? 'halohalo' : next.reach > before.reach ? 'mango' : next.hearts > before.hearts ? 'turon' : null;
         if (ate) {
            fx.current.push({ kind: 'pickup', at: where, start: at, text: FOOD_FX[ate] });
            buzz(12);
         }
         const left = new Set(next.sharks.map((k) => k.id));
         for (const k of before.sharks) {
            if (left.has(k.id)) continue;
            const g = sharkGlides.current.get(k.id);
            fx.current.push({ kind: 'poof', at: g ? glideAt(g, at) : k, start: at, text: '+100', flip: g ? g.to.x > g.from.x : false });
         }
         if (!before.portal && next.portal) {
            clarityEvent('chomp_wave_cleared');
            fx.current.push({ kind: 'pickup', at: next.portal, start: at, text: 'Door open! 🚪' });
            buzz(40);
         }
         if (!before.inHouse && next.inHouse) {
            heldDir.current = null;
            window.setTimeout(() => {
               setWheel({ due: wheelDueAfter(stateRef.current.wave), spun: null, angle: 0 });
               setPending([]);
               setPhase('house');
            }, 350);
         }
         sync();
      },
      [sync]
   );

   const applyMove = useCallback(
      (dir: Dir, at: number) => {
         const before = stateRef.current;
         const next = moveHippo(before, dir, at);
         if (dir === 'left') faceLeft.current = true;
         if (dir === 'right') faceLeft.current = false;
         if (next.wave === before.wave && (next.hippo.x !== before.hippo.x || next.hippo.y !== before.hippo.y)) {
            hippoGlide.current = { from: glideAt(hippoGlide.current, at), to: next.hippo, start: at, dur: at < before.fastUntil ? FAST_MOVE_MS : MOVE_MS };
         }
         afterUpdate(before, next, at);
      },
      [afterUpdate]
   );

   const bite = useCallback(() => {
      if (!active) return;
      const at = Date.now();
      const before = stateRef.current;
      const next = chomp(before, at, Math.random);
      if (next === before) return;
      lungeAt.current = at;
      const cleared = false;
      // The dash: a quick glide to where the bite landed.
      if (!cleared && (next.hippo.x !== before.hippo.x || next.hippo.y !== before.hippo.y)) {
         const tilesGone = Math.abs(next.hippo.x - before.hippo.x) + Math.abs(next.hippo.y - before.hippo.y);
         hippoGlide.current = { from: glideAt(hippoGlide.current, at), to: next.hippo, start: at, dur: 70 * tilesGone };
         nextMoveAt.current = at + 70 * tilesGone;
      }
      buzz(18);
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[before.facing];
      // The nom where she lands after the dash (or just in front of her if a rock stopped her).
      const dashed = !cleared && (next.hippo.x !== before.hippo.x || next.hippo.y !== before.hippo.y);
      const ahead = dashed ? { x: next.hippo.x + d[0] * 0.35, y: next.hippo.y + d[1] * 0.35 } : { x: before.hippo.x + d[0] * 0.6, y: before.hippo.y + d[1] * 0.6 };
      fx.current.push({ kind: 'chomp', at: ahead, start: at });
      afterUpdate(before, next, at);
   }, [active, afterUpdate]);

   const start = () => {
      const at = Date.now();
      stateRef.current = newWave(1, Math.random);
      snapAll(stateRef.current, at);
      fx.current = [];
      setPhase('lesson');
      sync();
      clarityEvent('chomp_game_start');
   };

   // From the level-1 card, or out of Moodeng's House into the next level (with what they bought/won).
   const beginLevel = () => {
      const at = Date.now();
      if (stateRef.current.inHouse) {
         let next = nextLevel(stateRef.current, Math.random);
         for (const f of pending) next = applySnack(next, f, at + 700);
         stateRef.current = next;
         setPending([]);
         sync();
      }
      snapAll(stateRef.current, at);
      lastSharkStep.current = at + 700; // a breath before the sharks start swimming
      setPhase('playing');
   };

   // ── drawing ───────────────────────────────────────────────────────────────────────────────────
   const draw = useCallback(
      (at: number) => {
         const c = canvasRef.current;
         const ctx = c?.getContext('2d');
         if (!c || !ctx) return;
         const s = stateRef.current;
         const t = tile;
         const W = COLS * t;
         const H = ROWS * t;
         const dpr = Math.min(3, window.devicePixelRatio || 1);
         if (c.width !== Math.round(W * dpr)) {
            c.width = Math.round(W * dpr);
            c.height = Math.round(H * dpr);
            c.style.width = `${W}px`;
            c.style.height = `${H}px`;
         }
         ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
         ctx.imageSmoothingQuality = 'high';

         // Water, with slow ripples.
         const water = ctx.createLinearGradient(0, 0, 0, H);
         water.addColorStop(0, '#a8def7');
         water.addColorStop(1, '#7cc6ec');
         ctx.fillStyle = water;
         ctx.fillRect(0, 0, W, H);
         ctx.strokeStyle = 'rgba(255,255,255,0.22)';
         ctx.lineWidth = Math.max(1, t * 0.05);
         for (let y = 1; y < ROWS - 1; y += 2) {
            for (let x = 1; x < COLS - 1; x += 3) {
               const ph = at / 900 + x * 1.3 + y * 0.7;
               const cx = x * t + t / 2 + Math.sin(ph) * t * 0.25;
               const cy = y * t + t * 0.7;
               ctx.beginPath();
               ctx.arc(cx, cy, t * 0.28, Math.PI * 1.15, Math.PI * 1.85);
               ctx.stroke();
            }
         }

         // Rocks and seaweed (seaweed sways).
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
               const cell = s.grid[y][x];
               const px = x * t;
               const py = y * t;
               if (cell === 'rock') {
                  ctx.fillStyle = '#6f6888';
                  ctx.beginPath();
                  ctx.roundRect(px + 1, py + 2, t - 2, t - 2, t * 0.3);
                  ctx.fill();
                  ctx.fillStyle = '#8d86a6';
                  ctx.beginPath();
                  ctx.roundRect(px + 1, py + 1, t - 2, t - 5, t * 0.3);
                  ctx.fill();
                  ctx.fillStyle = 'rgba(255,255,255,0.18)';
                  ctx.beginPath();
                  ctx.roundRect(px + t * 0.18, py + t * 0.14, t * 0.4, t * 0.18, t * 0.1);
                  ctx.fill();
               } else if (cell === 'weed') {
                  // A kelp clump on a sandy patch: five swaying blades, dark behind, light in front.
                  ctx.fillStyle = 'rgba(214, 196, 150, 0.55)';
                  ctx.beginPath();
                  ctx.ellipse(px + t / 2, py + t * 0.82, t * 0.42, t * 0.15, 0, 0, Math.PI * 2);
                  ctx.fill();
                  const sway = Math.sin(at / 650 + x * 0.9 + y * 1.7);
                  const blades = [
                     { dx: -0.2, h: 0.62, c: '#2f8a4c' },
                     { dx: 0.22, h: 0.66, c: '#2f8a4c' },
                     { dx: 0.02, h: 0.82, c: '#3fa45d' },
                     { dx: -0.1, h: 0.58, c: '#58c172' },
                     { dx: 0.12, h: 0.54, c: '#6fd287' }
                  ];
                  for (const [i, b] of blades.entries()) {
                     const bx = px + t / 2 + b.dx * t;
                     const by = py + t * 0.84;
                     const tipX = bx + sway * t * 0.12 * (1 + i * 0.15) + b.dx * t * 0.3;
                     const tipY = by - b.h * t;
                     ctx.fillStyle = b.c;
                     ctx.beginPath();
                     ctx.moveTo(bx - t * 0.07, by);
                     ctx.quadraticCurveTo(bx - t * 0.1 + sway * t * 0.06, by - b.h * t * 0.55, tipX, tipY);
                     ctx.quadraticCurveTo(bx + t * 0.1 + sway * t * 0.06, by - b.h * t * 0.5, bx + t * 0.07, by);
                     ctx.closePath();
                     ctx.fill();
                  }
               } else if (isFood(cell)) {
                  // A snack: bobbing, with a soft glow so it's easy to spot.
                  const bob = Math.sin(at / 300 + x + y) * t * 0.07;
                  const glow = ctx.createRadialGradient(px + t / 2, py + t / 2, 0, px + t / 2, py + t / 2, t * 0.55);
                  glow.addColorStop(0, 'rgba(255, 244, 180, 0.85)');
                  glow.addColorStop(1, 'rgba(255, 244, 180, 0)');
                  ctx.fillStyle = glow;
                  ctx.fillRect(px, py, t, t);
                  const img = imgs.current?.[cell];
                  if (ready(img)) {
                     const im = img as HTMLImageElement;
                     const h = t * 0.8;
                     const w = Math.min(t * 0.95, (h * im.naturalWidth) / im.naturalHeight);
                     ctx.drawImage(im, px + (t - w) / 2, py + (t - h) / 2 + bob, w, (w * im.naturalHeight) / im.naturalWidth);
                  }
               }
            }
         }

         // Characters, drawn back to front so whoever is lower on screen stands in front.
         type Actor = { y: number; paint: () => void };
         const actors: Actor[] = [];
         const shadow = (cx: number, by: number, w: number) => {
            ctx.fillStyle = 'rgba(20, 40, 80, 0.22)';
            ctx.beginPath();
            ctx.ellipse(cx, by, w, w * 0.32, 0, 0, Math.PI * 2);
            ctx.fill();
         };

         for (const k of s.sharks) {
            let g = sharkGlides.current.get(k.id);
            if (!g) {
               g = { from: { x: k.x, y: k.y }, to: { x: k.x, y: k.y }, start: at, dur: 1 };
               sharkGlides.current.set(k.id, g);
            }
            const p = glideAt(g, at);
            const goingRight = g.to.x > g.from.x || (g.to.x === g.from.x && k.dir === 'right');
            const swim = moving(g, at);
            actors.push({
               y: p.y,
               paint: () => {
                  const cx = p.x * t + t / 2;
                  const by = p.y * t + t * 0.92;
                  shadow(cx, by, t * 0.34);
                  const img = imgs.current?.shark;
                  const h = t * 1.22;
                  const w = h * (309 / 300);
                  const hop = swim ? Math.abs(Math.sin(at / 95)) * t * 0.08 : Math.sin(at / 400 + k.id) * t * 0.03;
                  ctx.save();
                  ctx.translate(cx, by - hop);
                  if (goingRight) ctx.scale(-1, 1);
                  ctx.rotate(swim ? Math.sin(at / 95) * 0.06 : 0);
                  if (ready(img)) ctx.drawImage(img as HTMLImageElement, -w / 2, -h, w, h);
                  else {
                     ctx.font = `${Math.floor(t * 0.8)}px system-ui, "Apple Color Emoji", sans-serif`;
                     ctx.fillText('🦈', 0, -t * 0.45);
                  }
                  ctx.restore();
               }
            });
         }

         {
            const g = hippoGlide.current;
            const p = glideAt(g, at);
            const walking = moving(g, at) || Boolean(heldDir.current && active);
            const lunge = Math.max(0, 1 - (at - lungeAt.current) / 170);
            const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[s.facing];
            const lx = d[0] * lunge * t * 0.28;
            const ly = d[1] * lunge * t * 0.28;
            const hurt = at < s.invulnerableUntil;
            actors.push({
               y: p.y + 0.01,
               paint: () => {
                  const cx = p.x * t + t / 2 + lx;
                  const by = p.y * t + t * 0.94 + ly;
                  shadow(cx, by, t * 0.36);
                  const stride = Math.floor(at / STRIDE_MS) % 2;
                  // A chomp shows her nom: mouth open for the bite, then a happy munch.
                  const sinceBite = at - lungeAt.current;
                  const nom = sinceBite < 200 ? 'open' : sinceBite < 560 ? 'munch' : null;
                  // She faces the way she swims: side frames left/right, front frames down, back frames up.
                  const vertical = s.facing === 'up' || s.facing === 'down';
                  const sheet = imgs.current;
                  const step = walking ? stride : 0;
                  const img = nom === 'open'
                     ? sheet?.nomOpen
                     : nom === 'munch'
                       ? sheet?.nomMunch
                       : s.facing === 'down'
                         ? (step ? sheet?.front2 : sheet?.front1)
                         : s.facing === 'up'
                           ? (step ? sheet?.back2 : sheet?.back1)
                           : step
                             ? sheet?.run2
                             : sheet?.run1;
                  const nw = img?.naturalWidth || 80;
                  const nh = img?.naturalHeight || 120;
                  const h = nom ? t * 1.42 : vertical ? t * 1.36 : t * 1.3 * (nh / 120);
                  const w = h * (nw / nh);
                  const bounce = walking ? Math.abs(Math.sin(at / STRIDE_MS * Math.PI)) * t * 0.09 : 0;
                  const breathe = walking ? 1 : 1 + Math.sin(at / 500) * 0.025;
                  const squash = 1 + lunge * 0.14;
                  ctx.save();
                  ctx.translate(cx, by - bounce);
                  if (faceLeft.current && (!vertical || nom)) ctx.scale(-1, 1);
                  ctx.scale(squash, breathe / (1 + lunge * 0.06));
                  if (hurt) ctx.globalAlpha = 0.6;
                  if (at < s.fastUntil && walking) {
                     ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                     ctx.lineWidth = t * 0.05;
                     for (let i = 0; i < 3; i++) {
                        const yy = -h * (0.25 + i * 0.2);
                        ctx.beginPath();
                        ctx.moveTo(-w * 0.55, yy);
                        ctx.lineTo(-w * (0.85 + ((at / 60 + i) % 3) * 0.08), yy);
                        ctx.stroke();
                     }
                  }
                  if (ready(img)) ctx.drawImage(img as HTMLImageElement, -w / 2, -h, w, h);
                  if (at < s.shieldUntil) {
                     // Halo-halo shield: a soft pastel bubble, blinking gently in its last second.
                     const left = s.shieldUntil - at;
                     ctx.globalAlpha = left < 1000 ? 0.35 + 0.35 * Math.abs(Math.sin(at / 90)) : 0.7;
                     const bubble = ctx.createRadialGradient(0, -h * 0.45, h * 0.2, 0, -h * 0.45, h * 0.62);
                     bubble.addColorStop(0, 'rgba(215, 198, 255, 0)');
                     bubble.addColorStop(0.8, 'rgba(215, 198, 255, 0.35)');
                     bubble.addColorStop(1, 'rgba(255, 255, 255, 0.9)');
                     ctx.fillStyle = bubble;
                     ctx.beginPath();
                     ctx.arc(0, -h * 0.45, h * 0.62, 0, Math.PI * 2);
                     ctx.fill();
                  }
                  else {
                     ctx.font = `${Math.floor(t * 0.9)}px system-ui, "Apple Color Emoji", sans-serif`;
                     ctx.fillText('🦛', 0, -t * 0.5);
                  }
                  ctx.restore();
               }
            });
         }

         if (s.portal) {
            // The door to Moodeng's House: a warm glowing arch with a pulsing ring.
            const px = s.portal.x * t;
            const py = s.portal.y * t;
            const pulse = (at % 1200) / 1200;
            ctx.strokeStyle = `rgba(255, 210, 90, ${1 - pulse})`;
            ctx.lineWidth = t * 0.08;
            ctx.beginPath();
            ctx.arc(px + t / 2, py + t * 0.55, t * (0.45 + pulse * 0.4), 0, Math.PI * 2);
            ctx.stroke();
            const door = ctx.createLinearGradient(0, py, 0, py + t);
            door.addColorStop(0, '#fff3c4');
            door.addColorStop(1, '#ffb703');
            ctx.fillStyle = '#7661f9';
            ctx.beginPath();
            ctx.moveTo(px + t * 0.12, py + t * 0.95);
            ctx.lineTo(px + t * 0.12, py + t * 0.42);
            ctx.arc(px + t / 2, py + t * 0.42, t * 0.38, Math.PI, 0);
            ctx.lineTo(px + t * 0.88, py + t * 0.95);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = door;
            ctx.beginPath();
            ctx.moveTo(px + t * 0.22, py + t * 0.95);
            ctx.lineTo(px + t * 0.22, py + t * 0.45);
            ctx.arc(px + t / 2, py + t * 0.45, t * 0.28, Math.PI, 0);
            ctx.lineTo(px + t * 0.78, py + t * 0.95);
            ctx.closePath();
            ctx.fill();
            ctx.font = `${Math.floor(t * 0.36)}px system-ui, "Apple Color Emoji", sans-serif`;
            ctx.fillText('🏠', px + t / 2, py + t * 0.6 + Math.sin(at / 250) * t * 0.04);
         }

         actors.sort((a, b) => a.y - b.y).forEach((a) => a.paint());

         // Effects on top.
         fx.current = fx.current.filter((f) => at - f.start < 700);
         for (const f of fx.current) {
            const k = (at - f.start) / 700;
            const cx = f.at.x * t + t / 2;
            const cy = f.at.y * t + t / 2;
            ctx.save();
            if (f.kind === 'chomp') {
               // Cute bite: little hearts and sparkles puff out, and a pink "nom!".
               ctx.save();
               ctx.font = `${Math.floor(t * 0.38)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
               for (let i = 0; i < 5; i++) {
                  const a = -Math.PI / 2 + (i - 2) * 0.55;
                  const r = t * (0.25 + k * 0.85);
                  ctx.globalAlpha = Math.max(0, 1 - k * 1.2);
                  ctx.fillText(i % 2 ? '✨' : '💕', cx + Math.cos(a) * r, cy + Math.sin(a) * r - k * t * 0.2);
               }
               ctx.restore();
               ctx.globalAlpha = 1 - k;
               // Keep the word inside the lagoon even when she bites at its edge.
               ctx.translate(Math.min(W - t * 1.6, Math.max(t * 1.6, cx)), Math.max(t * 0.8, cy - t * 1.35 - k * t * 0.5));
               const sc = 0.7 + Math.min(1, k * 4) * 0.5;
               ctx.scale(sc, sc);
               ctx.font = `800 ${Math.floor(t * 0.5)}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`;
               ctx.lineWidth = t * 0.12;
               ctx.lineJoin = 'round';
               ctx.strokeStyle = '#ffffff';
               ctx.strokeText('nom!', 0, 0);
               ctx.fillStyle = '#f0609b';
               ctx.fillText('nom!', 0, 0);
            } else if (f.kind === 'poof') {
               const img = imgs.current?.shark;
               ctx.globalAlpha = Math.max(0, 1 - k * 1.3);
               ctx.translate(cx, cy);
               ctx.save();
               ctx.rotate(k * 5);
               ctx.scale(1 - k, 1 - k);
               if (f.flip) ctx.scale(-1, 1);
               if (ready(img)) ctx.drawImage(img as HTMLImageElement, -t * 0.5, -t * 0.62, t, t * 1.25);
               ctx.restore();
               ctx.font = `${Math.floor(t * 0.34)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
               for (let i = 0; i < 6; i++) {
                  const a = (i / 6) * Math.PI * 2 + k;
                  ctx.fillText('✨', Math.cos(a) * t * 0.45 * (1 + k), Math.sin(a) * t * 0.45 * (1 + k));
               }
               ctx.globalAlpha = 1 - k;
               ctx.font = `800 ${Math.floor(t * 0.45)}px system-ui, sans-serif`;
               ctx.fillStyle = '#ffffff';
               ctx.strokeStyle = '#6b55f7';
               ctx.lineWidth = t * 0.1;
               ctx.strokeText(f.text ?? '', 0, -t * 0.7 - k * t * 0.5);
               ctx.fillText(f.text ?? '', 0, -t * 0.7 - k * t * 0.5);
            } else if (f.kind === 'hit') {
               ctx.globalAlpha = 1 - k;
               ctx.strokeStyle = '#ff4d6d';
               ctx.lineWidth = t * 0.12;
               ctx.beginPath();
               ctx.arc(cx, cy, t * (0.4 + k * 0.6), 0, Math.PI * 2);
               ctx.stroke();
            } else if (f.kind === 'pickup') {
               ctx.globalAlpha = 1 - k;
               ctx.font = `800 ${Math.floor(t * 0.46)}px system-ui, "Apple Color Emoji", sans-serif`;
               ctx.lineWidth = t * 0.1;
               ctx.strokeStyle = '#6b55f7';
               ctx.fillStyle = '#ffffff';
               ctx.strokeText(f.text ?? '', cx, cy - t * 0.9 - k * t * 0.6);
               ctx.fillText(f.text ?? '', cx, cy - t * 0.9 - k * t * 0.6);
            }
            ctx.restore();
         }
      },
      [tile, imgs, active]
   );

   // ── the loop: held movement on a steady beat, sharks on their clock, a redraw every frame ──────
   useEffect(() => {
      let raf = 0;
      const loop = () => {
         const at = Date.now();
         if (active) {
            if (heldDir.current && at >= nextMoveAt.current) {
               applyMove(heldDir.current, at);
               nextMoveAt.current = at + (at < stateRef.current.fastUntil ? FAST_MOVE_MS : MOVE_MS);
            }
            const s = stateRef.current;
            const stepMs = sharkStepMs(s.wave);
            if (at - lastSharkStep.current >= stepMs) {
               lastSharkStep.current = at;
               const next = stepSharks(s, at, Math.random);
               for (const k of next.sharks) {
                  const old = s.sharks.find((o) => o.id === k.id);
                  const g = sharkGlides.current.get(k.id);
                  const from = g ? glideAt(g, at) : old ? { x: old.x, y: old.y } : { x: k.x, y: k.y };
                  sharkGlides.current.set(k.id, { from, to: { x: k.x, y: k.y }, start: at, dur: stepMs });
               }
               afterUpdate(s, next, at);
            }
         }
         draw(at);
         raf = window.requestAnimationFrame(loop);
      };
      raf = window.requestAnimationFrame(loop);
      return () => window.cancelAnimationFrame(raf);
   }, [active, draw, afterUpdate, applyMove]);

   // Keyboard (desktop): hold arrows / WASD to swim, space or enter chomps.
   useEffect(() => {
      const keys: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
      const down = (e: KeyboardEvent) => {
         const dir = keys[e.key];
         if (dir) {
            e.preventDefault();
            if (heldDir.current !== dir) {
               heldDir.current = dir;
               nextMoveAt.current = 0;
            }
         } else if ((e.key === ' ' || e.key === 'Enter') && active) {
            e.preventDefault();
            if (!e.repeat) bite();
         }
      };
      const up = (e: KeyboardEvent) => {
         if (keys[e.key] && heldDir.current === keys[e.key]) heldDir.current = null;
      };
      window.addEventListener('keydown', down);
      window.addEventListener('keyup', up);
      return () => {
         window.removeEventListener('keydown', down);
         window.removeEventListener('keyup', up);
      };
   }, [bite, active]);

   // Thumb joystick: put your thumb down anywhere in the pad and slide the way you want to swim.
   const joyDown = (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      joyOrigin.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      setJoyKnob({ dx: 0, dy: 0 });
   };
   const joyMove = (e: ReactPointerEvent<HTMLDivElement>) => {
      const o = joyOrigin.current;
      if (!o || o.id !== e.pointerId) return;
      const dx = e.clientX - o.x;
      const dy = e.clientY - o.y;
      const len = Math.hypot(dx, dy);
      const max = 38;
      setJoyKnob({ dx: len > max ? (dx / len) * max : dx, dy: len > max ? (dy / len) * max : dy });
      if (len < JOY_DEAD) {
         heldDir.current = null;
         return;
      }
      const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      if (heldDir.current !== dir) {
         heldDir.current = dir;
         nextMoveAt.current = Math.max(nextMoveAt.current, hippoGlide.current.start + MOVE_MS * 0.6);
      }
   };
   const joyUp = (e: ReactPointerEvent<HTMLDivElement>) => {
      if (joyOrigin.current?.id !== e.pointerId) return;
      joyOrigin.current = null;
      heldDir.current = null;
      setJoyKnob(null);
   };

   const goldBtn =
      'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#ffb703] text-[18px] font-bold text-[#3b2a00] shadow-[0_6px_16px_rgba(255,183,3,0.4)] active:scale-[0.98]';

   return (
      <main
         className="fixed inset-0 flex select-none flex-col bg-[#f8f1ff] text-[#594d65]"
         style={{
            paddingTop: 'max(10px, env(safe-area-inset-top))',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            paddingLeft: 'max(12px, env(safe-area-inset-left))',
            paddingRight: 'max(12px, env(safe-area-inset-right))',
            touchAction: 'none',
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none'
         }}
      >
         <div className="mx-auto flex h-full w-full max-w-[480px] flex-col gap-2">
            {callLabel ? (
               <div className="flex shrink-0 items-center justify-between gap-2 rounded-full bg-white px-4 py-2 text-[14px] font-semibold shadow-sm">
                  <span>⏰ {callLabel}</span>
                  {joinUrl ? (
                     <a className="flex items-center gap-1 text-[#6b55f7]" href={joinUrl} rel="noreferrer" target="_blank">
                        <Video aria-hidden="true" className="size-4" /> Join
                     </a>
                  ) : null}
               </div>
            ) : null}

            <div className="flex shrink-0 items-center justify-between px-1 text-[14px] font-bold">
               <span className="flex items-center gap-1.5">
                  <span aria-label={`${hud.hearts} hearts`}>{'❤️'.repeat(Math.max(0, hud.hearts))}</span>
                  <img alt="Bite" className="ml-1 h-[18px] w-auto" src={SPRITES.mango} />
                  <span>{hud.reach}</span>
                  {Date.now() < powers.shield ? <img alt="Shield on" className="h-[18px] w-auto" src={SPRITES.halohalo} /> : null}
                  {Date.now() < powers.fast ? <img alt="Fast" className="h-[16px] w-auto" src={SPRITES.pandesal} /> : null}
               </span>
               <span>Level {hud.wave}</span>
               <span className="flex items-center gap-1">
                  🍞 {coins}
                  <span className="font-semibold text-[#9a8bab]">· {hud.score}</span>
               </span>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center" ref={boardRef}>
               <div className="relative overflow-hidden rounded-[18px] border-[3px] border-[#7661f9] shadow-[0_8px_24px_rgba(107,85,247,0.25)]">
                  <canvas className="block" ref={canvasRef} />

                  {showCallScreen ? (
                     <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#f8f1ffee] px-5 text-center">
                        <span className="text-[22px] font-bold">Your call is starting! 🎥</span>
                        <span className="text-[15px]">Have your ID ready and video on.</span>
                        {joinUrl ? (
                           <a className={goldBtn} href={joinUrl} onClick={() => clarityEvent('chomp_join_call')} rel="noreferrer" target="_blank">
                              <Video aria-hidden="true" className="size-5" /> Join the call now
                           </a>
                        ) : (
                           <span className="text-[15px] font-semibold">Open the Zoom link we sent you on Messenger.</span>
                        )}
                        <button className="min-h-[44px] text-[14px] font-semibold text-[#7b6b8c]" onClick={() => setCallDismissed(true)} type="button">
                           I&apos;m already in the call
                        </button>
                     </div>
                  ) : phase === 'over' ? (
                     <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#f8f1ffee] px-5 text-center">
                        <img alt="" className="h-[30%] w-auto" src={SPRITES.shark} />
                        <span className="text-[26px] font-bold">The sharks got you!</span>
                        <span className="text-[16px]">
                           Level <b>{hud.wave}</b> · 🍞 {coins} · Score {hud.score}
                        </span>
                        {hud.score >= best && hud.score > 0 ? <span className="text-[15px] font-semibold text-[#2f7a3a]">🎉 New best!</span> : null}
                        <span className="text-[14px] text-[#7b6b8c]">In real life, say no to loan sharks. Moodeng has your back.</span>
                        <button className={goldBtn} onClick={start} type="button">
                           Play again
                        </button>
                     </div>
                  ) : null}
               </div>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-4 px-1 pt-1">
               {/* Joystick pad: thumb down anywhere in it, slide to swim. */}
               <div
                  aria-label="Swim: slide your thumb"
                  className="relative flex size-[132px] items-center justify-center rounded-full bg-white/80 shadow-[inset_0_2px_10px_rgba(107,85,247,0.15)]"
                  onPointerCancel={joyUp}
                  onPointerDown={joyDown}
                  onPointerMove={joyMove}
                  onPointerUp={joyUp}
                  role="application"
                  style={{ touchAction: 'none' }}
               >
                  <span className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-[12px] text-[#b3a5c4]">▲</span>
                  <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[12px] text-[#b3a5c4]">▼</span>
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[12px] text-[#b3a5c4]">◀</span>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] text-[#b3a5c4]">▶</span>
                  <span
                     className="pointer-events-none size-[58px] rounded-full bg-[#7661f9] shadow-[0_4px_10px_rgba(107,85,247,0.45)]"
                     style={{ transform: `translate(${joyKnob?.dx ?? 0}px, ${joyKnob?.dy ?? 0}px)`, transition: joyKnob ? 'none' : 'transform 120ms ease-out' }}
                  />
               </div>
               <button
                  className="flex size-[118px] touch-none select-none flex-col items-center justify-center rounded-full bg-[#ffb703] text-[19px] font-black text-[#3b2a00] shadow-[0_7px_0_#d99a00] active:translate-y-[4px] active:shadow-[0_3px_0_#d99a00]"
                  onPointerDown={(e) => {
                     e.preventDefault();
                     bite();
                  }}
                  style={{ touchAction: 'none' }}
                  type="button"
               >
                  <img alt="" className="h-[52px] w-auto" draggable={false} src={SPRITES.nomOpen} />
                  CHOMP
               </button>
            </div>
         </div>

         {phase === 'intro' || phase === 'lesson' || phase === 'house' ? (
            <div
               className="absolute inset-0 z-10 overflow-y-auto bg-[#f8f1ff]"
               style={{ paddingTop: 'max(14px, env(safe-area-inset-top))', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', touchAction: 'pan-y' }}
            >
               <div className="mx-auto flex min-h-full w-full max-w-[440px] flex-col items-center gap-4 px-5 text-center">
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

                  {phase === 'intro' ? (
                     <>
                        <div className="flex flex-1 flex-col items-center justify-center gap-4">
                           <img alt="" className="h-[200px] w-auto object-contain" src={INTRO_SLIDES[slide].img} />
                           <h1 className="text-[26px] font-bold leading-tight">{INTRO_SLIDES[slide].title}</h1>
                           <p className="text-[16px] leading-snug">{INTRO_SLIDES[slide].text}</p>
                           <div className="flex gap-1.5">
                              {INTRO_SLIDES.map((sl, i) => (
                                 <span className={`size-2 rounded-full ${i === slide ? 'bg-[#7661f9]' : 'bg-[#d8cffc]'}`} key={sl.title} />
                              ))}
                           </div>
                        </div>
                        {slide < INTRO_SLIDES.length - 1 ? (
                           <button className={goldBtn} onClick={() => setSlide(slide + 1)} type="button">
                              Next
                           </button>
                        ) : (
                           <>
                              <div className="w-full rounded-[18px] bg-white p-4 text-left text-[14px] shadow-sm">
                                 <p className="mb-2 font-bold">How to play</p>
                                 <p>👈 Slide your thumb on the left to swim.</p>
                                 <p>👉 Tap <b>CHOMP</b>: Moodeng dashes forward and eats sharks.</p>
                                 <p className="mb-2">🚪 Eat every shark and a door opens to Moodeng&apos;s House.</p>
                                 <p className="mb-1 font-bold">Snacks in the seaweed</p>
                                 <ul className="grid grid-cols-2 gap-2">
                                    {FOOD_LIST.map((f) => (
                                       <li className="flex items-center gap-2" key={f}>
                                          <img alt="" className="h-[28px] w-[34px] object-contain" src={SPRITES[f]} />
                                          <span className="leading-tight">
                                             <b>{FOODS[f].name}</b>
                                             <br />
                                             <span className="text-[12px] text-[#7b6b8c]">{FOODS[f].power}</span>
                                          </span>
                                       </li>
                                    ))}
                                 </ul>
                              </div>
                              <button className={goldBtn} onClick={start} type="button">
                                 Let&apos;s chomp!
                              </button>
                           </>
                        )}
                     </>
                  ) : phase === 'lesson' ? (
                     <LessonCard onGo={beginLevel} wave={hud.wave} />
                  ) : (
                     <>
                        <h1 className="text-[24px] font-bold">🏠 Moodeng&apos;s House</h1>
                        <p className="-mt-2 text-[15px]">You cleared level {hud.wave}! Rest here, then on to the next.</p>
                        <LessonCard wave={hud.wave + 1} />

                        {wheel.due ? (
                           <PrizeWheel
                              angle={wheel.angle}
                              onSpin={() => {
                                 const i = spinWheel(Math.random);
                                 let before = 0;
                                 for (let j = 0; j < i; j++) before += WHEEL[j].weight;
                                 const mid = ((before + WHEEL[i].weight * (0.2 + Math.random() * 0.6)) / WHEEL_TOTAL) * 360;
                                 setWheel({ due: true, spun: -1, angle: 360 * 6 + (360 - mid) });
                                 window.setTimeout(() => {
                                    const prize = WHEEL[i];
                                    if (prize.coins) stateRef.current = { ...stateRef.current, coins: stateRef.current.coins + prize.coins };
                                    if (prize.snack) setPending((p) => [...p, prize.snack as Food]);
                                    setWheel((w) => ({ ...w, spun: i }));
                                    sync();
                                    buzz(30);
                                    clarityEvent('chomp_wheel_spin');
                                 }, 4200);
                              }}
                              spun={wheel.spun}
                           />
                        ) : null}

                        <div className="w-full rounded-[18px] bg-white p-4 text-left shadow-sm">
                           <div className="mb-2 flex items-center justify-between">
                              <span className="font-bold">Power up for the next level</span>
                              <span className="font-bold">🍞 {coins}</span>
                           </div>
                           <ul className="flex flex-col gap-2">
                              {FOOD_LIST.map((f) => {
                                 const price = SHOP[f];
                                 const can = coins >= price;
                                 return (
                                    <li className="flex items-center gap-3" key={f}>
                                       <img alt="" className="h-[36px] w-[44px] object-contain" src={SPRITES[f]} />
                                       <span className="flex-1 leading-tight">
                                          <b>{FOODS[f].name}</b>
                                          <br />
                                          <span className="text-[12px] text-[#7b6b8c]">{FOODS[f].power}</span>
                                       </span>
                                       <button
                                          className={`min-h-[40px] min-w-[74px] rounded-full px-3 text-[14px] font-bold ${can ? 'bg-[#ffb703] text-[#3b2a00]' : 'bg-[#eee8f6] text-[#b3a5c4]'}`}
                                          disabled={!can}
                                          onClick={() => {
                                             if (stateRef.current.coins < price) return;
                                             stateRef.current = { ...stateRef.current, coins: stateRef.current.coins - price };
                                             setPending((p) => [...p, f]);
                                             sync();
                                             buzz(12);
                                          }}
                                          type="button"
                                       >
                                          🍞 {price}
                                       </button>
                                    </li>
                                 );
                              })}
                           </ul>
                           {pending.length ? (
                              <p className="mt-3 flex flex-wrap items-center gap-1 text-[13px] font-semibold text-[#2f7a3a]">
                                 Ready for next level:
                                 {FOOD_LIST.filter((f) => pending.includes(f)).map((f) => (
                                    <span className="flex items-center" key={f}>
                                       <img alt={FOODS[f].name} className="h-[22px] w-auto" src={SPRITES[f]} />
                                       {pending.filter((x) => x === f).length > 1 ? `×${pending.filter((x) => x === f).length}` : ''}
                                    </span>
                                 ))}
                              </p>
                           ) : (
                              <p className="mt-3 text-[12px] text-[#7b6b8c]">Earn 🍞 pandesal points: 1 per shark, 3 per level.</p>
                           )}
                        </div>

                        <button className={goldBtn} disabled={wheel.spun === -1} onClick={beginLevel} type="button">
                           Level {hud.wave + 1} ▶
                        </button>
                     </>
                  )}
               </div>
            </div>
         ) : null}
      </main>
   );
}

// The lesson for a level: Moodeng with a short, plain explanation of how borrowing with us works.
function LessonCard({ wave, onGo }: { wave: number; onGo?: () => void }) {
   const lesson = lessonFor(wave);
   return (
      <div className="flex w-full flex-col items-center gap-2 rounded-[18px] border-2 border-[#7661f9] bg-white p-4 shadow-sm">
         <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#7661f9]">Level {lesson.level}</span>
         <img alt="" className="h-[110px] w-auto" src="/hippos/body/hippo-body.webp" />
         <h2 className="text-[20px] font-bold leading-tight">{lesson.title}</h2>
         <p className="text-[15px] leading-snug">{lesson.text}</p>
         {lesson.tip ? <p className="text-[13px] font-semibold text-[#7b6b8c]">{lesson.tip}</p> : null}
         {onGo ? (
            <button
               className="mt-1 flex min-h-[52px] w-full items-center justify-center rounded-full bg-[#ffb703] text-[18px] font-bold text-[#3b2a00] shadow-[0_6px_16px_rgba(255,183,3,0.4)]"
               onClick={onGo}
               type="button"
            >
               Start level {lesson.level}
            </button>
         ) : null}
      </div>
   );
}

// The prize wheel: slices are drawn as big as their real odds. spun: null = not yet, -1 = spinning, else the prize.
function PrizeWheel({ angle, spun, onSpin }: { angle: number; spun: number | null; onSpin: () => void }) {
   const R = 110;
   let at = 0;
   const point = (deg: number, r: number) => [R + r * Math.sin((deg * Math.PI) / 180), R - r * Math.cos((deg * Math.PI) / 180)];
   const slices = WHEEL.map((p) => {
      const a0 = at;
      const a1 = at + (p.weight / WHEEL_TOTAL) * 360;
      at = a1;
      const [x0, y0] = point(a0, R);
      const [x1, y1] = point(a1, R);
      const [lx, ly] = point((a0 + a1) / 2, R * 0.64);
      return (
         <g key={p.label}>
            <path d={`M${R},${R} L${x0},${y0} A${R},${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1},${y1} Z`} fill={p.color} stroke="#ffffff" strokeWidth={2} />
            <text dominantBaseline="middle" fill="#3b2a00" fontSize={12} fontWeight={800} textAnchor="middle" transform={`rotate(${(a0 + a1) / 2} ${lx} ${ly})`} x={lx} y={ly}>
               {p.label}
            </text>
         </g>
      );
   });
   const prize = spun !== null && spun >= 0 ? WHEEL[spun] : null;
   return (
      <div className="flex w-full flex-col items-center gap-3 rounded-[18px] bg-white p-4 shadow-sm">
         <span className="font-bold">🎡 Bonus spin!</span>
         <div className="relative">
            <span className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2 text-[26px] leading-none">▼</span>
            <svg
               className="block"
               height={R * 2}
               style={{ transform: `rotate(${angle}deg)`, transition: spun === -1 ? 'transform 4s cubic-bezier(0.12, 0.8, 0.2, 1)' : 'none' }}
               viewBox={`0 0 ${R * 2} ${R * 2}`}
               width={R * 2}
            >
               {slices}
               <circle cx={R} cy={R} fill="#7661f9" r={16} />
            </svg>
         </div>
         {prize ? (
            <span className="text-[16px] font-bold text-[#2f7a3a]">
               You won {prize.coins ? `${prize.coins} 🍞 pandesal points` : `a ${prize.label} for the next level`}! 🎉
            </span>
         ) : (
            <button
               className="min-h-[48px] w-full rounded-full bg-[#7661f9] text-[17px] font-bold text-white disabled:opacity-60"
               disabled={spun === -1}
               onClick={onSpin}
               type="button"
            >
               {spun === -1 ? 'Spinning…' : 'Spin the wheel'}
            </button>
         )}
      </div>
   );
}
