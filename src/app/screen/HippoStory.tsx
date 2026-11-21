import { useEffect, useState } from 'react';

// A little hippo flip-book for waits (Gemini-made frames, 2026-11-21) instead of a spinner: the frames loop
// with a caption each until `done`, which shows the last frame ("Looks good").
//   photo — the hippo frames the job photo        (photo check)
//   doc   — the hippo reads, stamps and files it   (payslips, GCash history, COE, work permit)
//   camera — the hippo sets up a phone, light, mirror, clapperboard (camera starting)
//   send   — the hippo seals the video in an envelope and flies it off (video answer sending)
export type StoryKind = 'photo' | 'doc' | 'camera' | 'send';

const STORIES: Record<StoryKind, { frames: string[]; final: string; lines: string[]; doneLine: string }> = {
   photo: {
      frames: ['a', 'b', 'c', 'd', 'e', 'f'].map((k) => `/hippos/story/frame-${k}.webp`),
      final: '/hippos/story/frame-g.webp',
      lines: ['Checking your photo…', 'Looking closely 🔍', 'Nice one!', 'Framing it…', 'Making it shine ✨', 'Almost there…'],
      doneLine: 'Looks good! ✅'
   },
   doc: {
      frames: ['a', 'b', 'c', 'd'].map((k) => `/hippos/docstory/frame-${k}.webp`),
      final: '/hippos/docstory/frame-e.webp',
      lines: ['Reading your document 🔍', 'Checking the details…', 'Stamping it ✓', 'Filing it safely 📁'],
      doneLine: 'All done! ✅'
   },
   camera: {
      frames: ['a', 'b', 'c', 'd'].map((k) => `/hippos/camstory/frame-${k}.webp`),
      final: '/hippos/camstory/frame-e.webp',
      lines: ['Getting your camera ready 🎥', 'Turning on the light 💡', 'Looking sharp ✨', 'Ready… action! 🎬'],
      doneLine: 'Ready! 👍'
   },
   send: {
      frames: ['a', 'b', 'c', 'd'].map((k) => `/hippos/sendstory/frame-${k}.webp`),
      final: '/hippos/sendstory/frame-e.webp',
      lines: ['Sending your answer…', 'Sealing it up 💌', 'Off it goes! ✈️', 'The team is watching 🍿'],
      doneLine: 'Sent! ✅'
   }
};

/** Fetch a story's frames ahead of the wait, so the first frame is there the moment it starts. */
export function preloadHippoStory(kind: StoryKind) {
   const story = STORIES[kind];
   for (const src of [...story.frames, story.final]) new Image().src = src;
}
const STEP_MS = 1100;

export default function HippoStory({
   kind,
   done = false,
   caption,
   tone = 'dark'
}: {
   kind: StoryKind;
   done?: boolean;
   /** Replaces the story's own caption (e.g. "Uploading 2 of 3…"). */
   caption?: string;
   /** dark = inside the photo box; light = on a white card. */
   tone?: 'dark' | 'light';
}) {
   const story = STORIES[kind];
   const [i, setI] = useState(0);
   useEffect(() => {
      if (done) return;
      const t = window.setInterval(() => setI((n) => (n + 1) % story.frames.length), STEP_MS);
      return () => window.clearInterval(t);
   }, [done, story.frames.length]);
   // Load every frame up front so the story doesn't flicker on slow data.
   useEffect(() => preloadHippoStory(kind), [kind]);
   const src = done ? story.final : story.frames[i];
   return (
      <div className="flex flex-col items-center justify-center gap-2" aria-live="polite">
         <img alt="" className="size-[min(60vw,200px)] object-contain" key={src} src={src} />
         <span className={`text-center text-[15px] font-bold ${tone === 'dark' ? 'text-white' : 'text-[#594d65] dark:text-[#d9cfe8]'}`}>
            {done ? story.doneLine : (caption ?? story.lines[i])}
         </span>
      </div>
   );
}
