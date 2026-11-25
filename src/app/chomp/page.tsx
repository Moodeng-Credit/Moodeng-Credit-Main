import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';

import { Video } from 'lucide-react';
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
   // Her nom poses (made with Gemini from the Moodeng art, 2026-11-25): mouth open, then a happy munch.
   nomOpen: '/chomp/chomp-open.webp',
   nomMunch: '/chomp/chomp-munch.webp',
   shark: '/chomp/shark.webp',
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

type Phase = 'intro' | 'playing' | 'over';

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
   const [hud, setHud] = useState({ score: 0, hearts: 3, wave: 1, reach: 2 });
   const [best, setBest] = useState(0);
   const [now, setNow] = useState(() => Date.now());
   const [tile, setTile] = useState(30);
   const [callDismissed, setCallDismissed] = useState(false);
   const [hidden, setHidden] = useState(false);

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

   const applyMove = useCallback(
      (dir: Dir, at: number) => {
         const before = stateRef.current;
         const next = moveHippo(before, dir, at);
         stateRef.current = next;
         if (dir === 'left') faceLeft.current = true;
         if (dir === 'right') faceLeft.current = false;
         if (next.hippo.x !== before.hippo.x || next.hippo.y !== before.hippo.y) {
            hippoGlide.current = { from: glideAt(hippoGlide.current, at), to: next.hippo, start: at, dur: MOVE_MS };
         }
         if (next.hearts < before.hearts) {
            fx.current.push({ kind: 'hit', at: next.hippo, start: at });
            buzz(70);
         }
         if (next.reach > before.reach) fx.current.push({ kind: 'pickup', at: next.hippo, start: at, text: '+🍉 longer bite' });
         else if (next.hearts > before.hearts) fx.current.push({ kind: 'pickup', at: next.hippo, start: at, text: '+❤️' });
         if (next !== before) sync();
      },
      [sync]
   );

   const bite = useCallback(() => {
      if (!active) return;
      const at = Date.now();
      const before = stateRef.current;
      const next = chomp(before, at, Math.random);
      if (next === before) return;
      stateRef.current = next;
      lungeAt.current = at;
      // The dash: a quick glide to where the bite landed.
      if (next.wave === before.wave && (next.hippo.x !== before.hippo.x || next.hippo.y !== before.hippo.y)) {
         const tilesGone = Math.abs(next.hippo.x - before.hippo.x) + Math.abs(next.hippo.y - before.hippo.y);
         hippoGlide.current = { from: glideAt(hippoGlide.current, at), to: next.hippo, start: at, dur: 70 * tilesGone };
         nextMoveAt.current = at + 70 * tilesGone;
      }
      if (next.reach > before.reach) fx.current.push({ kind: 'pickup', at: next.hippo, start: at, text: '+🍉 longer bite' });
      else if (next.hearts > before.hearts) fx.current.push({ kind: 'pickup', at: next.hippo, start: at, text: '+❤️' });
      buzz(18);
      const bitten = next.wave === before.wave ? next.chompTiles : [];
      const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[before.facing];
      // The nom where she lands after the dash (or just in front of her if a rock stopped her).
      const dashed = next.wave === before.wave && (next.hippo.x !== before.hippo.x || next.hippo.y !== before.hippo.y);
      const ahead = dashed ? { x: next.hippo.x + d[0] * 0.35, y: next.hippo.y + d[1] * 0.35 } : { x: before.hippo.x + d[0] * 0.6, y: before.hippo.y + d[1] * 0.6 };
      // Hearts + "nom!" right in front of her, plus on any adjacent shark she ate off to the side.
      fx.current.push({ kind: 'chomp', at: ahead, start: at });
      for (const p of bitten) if (Math.abs(p.x - ahead.x) + Math.abs(p.y - ahead.y) > 0 && Math.abs(p.x - before.hippo.x) <= 1 && Math.abs(p.y - before.hippo.y) <= 1 && before.sharks.some((k) => k.x === p.x && k.y === p.y)) fx.current.push({ kind: 'chomp', at: p, start: at });
      const left = new Set(next.wave === before.wave ? next.sharks.map((k) => k.id) : []);
      for (const k of before.sharks) {
         if (left.has(k.id)) continue;
         const g = sharkGlides.current.get(k.id);
         fx.current.push({ kind: 'poof', at: g ? glideAt(g, at) : k, start: at, text: '+100', flip: g ? g.to.x > g.from.x : false });
      }
      if (next.wave !== before.wave) {
         clarityEvent('chomp_wave_cleared');
         snapAll(next, at);
         fx.current.push({ kind: 'pickup', at: next.hippo, start: at, text: `Wave ${next.wave}!` });
         lastSharkStep.current = at + 600; // a breath before the new sharks start swimming
      }
      sync();
   }, [active, sync, snapAll]);

   const start = () => {
      const at = Date.now();
      stateRef.current = newWave(1, Math.random);
      snapAll(stateRef.current, at);
      fx.current = [];
      lastSharkStep.current = at + 500;
      setPhase('playing');
      sync();
      clarityEvent('chomp_game_start');
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
               } else if (cell === 'melon' || cell === 'heart') {
                  const bob = Math.sin(at / 300 + x + y) * t * 0.07;
                  ctx.font = `${Math.floor(t * 0.66)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
                  ctx.fillText(cell === 'melon' ? '🍉' : '❤️', px + t / 2, py + t / 2 + bob);
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
                  const h = t * 1.25;
                  const w = h * (190 / 242);
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
                  const img = nom === 'open' ? imgs.current?.nomOpen : nom === 'munch' ? imgs.current?.nomMunch : walking ? (stride ? imgs.current?.run2 : imgs.current?.run1) : imgs.current?.run1;
                  const natural = nom === 'open' ? { w: 215, h: 300 } : nom === 'munch' ? { w: 196, h: 300 } : walking && stride ? { w: 82, h: 110 } : { w: 78, h: 120 };
                  const h = nom ? t * 1.42 : t * 1.3 * (natural.h / 120);
                  const w = h * (natural.w / natural.h);
                  const bounce = walking ? Math.abs(Math.sin(at / STRIDE_MS * Math.PI)) * t * 0.09 : 0;
                  const breathe = walking ? 1 : 1 + Math.sin(at / 500) * 0.025;
                  const squash = 1 + lunge * 0.14;
                  ctx.save();
                  ctx.translate(cx, by - bounce);
                  if (faceLeft.current) ctx.scale(-1, 1);
                  ctx.scale(squash, breathe / (1 + lunge * 0.06));
                  if (hurt) ctx.globalAlpha = 0.6;
                  if (ready(img)) ctx.drawImage(img as HTMLImageElement, -w / 2, -h, w, h);
                  else {
                     ctx.font = `${Math.floor(t * 0.9)}px system-ui, "Apple Color Emoji", sans-serif`;
                     ctx.fillText('🦛', 0, -t * 0.5);
                  }
                  ctx.restore();
               }
            });
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
               nextMoveAt.current = at + MOVE_MS;
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
               stateRef.current = next;
               if (next.hearts < s.hearts) {
                  fx.current.push({ kind: 'hit', at: next.hippo, start: at });
                  buzz(70);
                  sync();
               }
            }
         }
         draw(at);
         raf = window.requestAnimationFrame(loop);
      };
      raf = window.requestAnimationFrame(loop);
      return () => window.cancelAnimationFrame(raf);
   }, [active, draw, sync, applyMove]);

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
                  <span className="text-[#9a8bab]">·</span>
                  <span>🍉 {hud.reach}</span>
               </span>
               <span>Wave {hud.wave}</span>
               <span>
                  {hud.score} <span className="font-semibold text-[#9a8bab]">/ best {Math.max(best, hud.score)}</span>
               </span>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center" ref={boardRef}>
               <div className="relative overflow-hidden rounded-[18px] border-[3px] border-[#7661f9] shadow-[0_8px_24px_rgba(107,85,247,0.25)]">
                  <canvas className="block" ref={canvasRef} />

                  {phase !== 'playing' || showCallScreen ? (
                     <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#f8f1ffee] px-5 text-center">
                        {showCallScreen ? (
                           <>
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
                           </>
                        ) : phase === 'intro' ? (
                           <>
                              <img alt="Moodeng the hippo chasing off a shark" className="max-h-[40%] w-auto object-contain" src={SPRITES.hero} />
                              <span className="text-[24px] font-bold">Shark Chomp</span>
                              <span className="text-[15px] leading-snug">
                                 Slide your thumb on the left to swim. Hit <b>CHOMP</b> to bite the sharks. Don&apos;t let them touch you!
                              </span>
                              <button className={goldBtn} onClick={start} type="button">
                                 Play
                              </button>
                           </>
                        ) : (
                           <>
                              <span className="text-[26px] font-bold">Game over!</span>
                              <span className="text-[16px]">
                                 Score <b>{hud.score}</b> · Wave {hud.wave}
                              </span>
                              {hud.score >= best && hud.score > 0 ? <span className="text-[15px] font-semibold text-[#2f7a3a]">🎉 New best!</span> : null}
                              <button className={goldBtn} onClick={start} type="button">
                                 Play again
                              </button>
                           </>
                        )}
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
      </main>
   );
}
