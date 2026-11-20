import { useEffect, useState } from 'react';

// While a job photo uploads and the AI looks at it (a few seconds): the hippo frames their photo, a little
// story in 7 pictures (Gemini-made, 2026-11-21) instead of a spinner. A→F loop until the check is done;
// `done` jumps to G (the photo on the wall) for the "Looks good" moment.
const FRAMES = ['a', 'b', 'c', 'd', 'e', 'f'].map((k) => `/hippos/story/frame-${k}.webp`);
const FINAL = '/hippos/story/frame-g.webp';
const LINES = ['Checking your photo…', 'Looking closely 🔍', 'Nice one!', 'Framing it…', 'Making it shine ✨', 'Almost there…'];
const STEP_MS = 1100;

export default function PhotoCheckStory({ done = false }: { done?: boolean }) {
   const [i, setI] = useState(0);
   useEffect(() => {
      if (done) return;
      const t = window.setInterval(() => setI((n) => (n + 1) % FRAMES.length), STEP_MS);
      return () => window.clearInterval(t);
   }, [done]);
   // Load every frame up front so the story doesn't flicker on slow data.
   useEffect(() => {
      for (const src of [...FRAMES, FINAL]) new Image().src = src;
   }, []);
   const src = done ? FINAL : FRAMES[i];
   return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4" aria-live="polite">
         <img alt="" className="size-[78%] max-h-[240px] max-w-[240px] object-contain" key={src} src={src} />
         <span className="text-center text-[15px] font-bold text-white">{done ? 'Looks good! ✅' : LINES[i]}</span>
      </div>
   );
}
