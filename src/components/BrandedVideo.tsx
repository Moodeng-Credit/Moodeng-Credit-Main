import { useEffect, useRef } from 'react';

// The Moodeng-framed YouTube player used by the pre-screening (/screen) and journey v2
// (/onboarding/verify). `onEnded` fires when the video plays to the end; `onBroken` if it can't load.
// ── The video they watch ────────────────────────────────────────────────────────────────────────────

type YTPlayer = { destroy: () => void };
type YTApi = {
   Player: new (
      el: HTMLElement,
      opts: {
         videoId: string;
         playerVars: Record<string, number | string>;
         events: { onStateChange?: (e: { data: number }) => void; onError?: () => void };
      }
   ) => YTPlayer;
};
type YTWindow = Window & { YT?: YTApi; onYouTubeIframeAPIReady?: () => void };

const loadYouTube = () =>
   new Promise<YTApi>((resolve, reject) => {
      const w = window as YTWindow;
      if (w.YT?.Player) return resolve(w.YT);
      const previous = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
         previous?.();
         if (w.YT) resolve(w.YT);
      };
      if (!document.querySelector('script[data-yt-api]')) {
         const script = document.createElement('script');
         script.src = 'https://www.youtube.com/iframe_api';
         script.dataset.ytApi = '1';
         script.onerror = () => reject(new Error('youtube blocked'));
         document.head.appendChild(script);
      }
      window.setTimeout(() => reject(new Error('youtube timeout')), 12000);
   });

/** The Moodeng-framed player. `onEnded` fires when the video plays to the end; `onBroken` if it can't load. */
export default function BrandedVideo({ videoId, tall = true, onEnded, onBroken }: { videoId: string; tall?: boolean; onEnded: () => void; onBroken: () => void }) {
   const holder = useRef<HTMLDivElement>(null);
   const ended = useRef(onEnded);
   const broken = useRef(onBroken);
   ended.current = onEnded;
   broken.current = onBroken;

   useEffect(() => {
      let player: YTPlayer | null = null;
      let gone = false;
      loadYouTube()
         .then((YT) => {
            if (gone || !holder.current) return;
            const el = document.createElement('div');
            holder.current.appendChild(el);
            player = new YT.Player(el, {
               videoId,
               playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
               events: {
                  onStateChange: (e) => {
                     if (e.data === 0) ended.current();
                  },
                  onError: () => broken.current()
               }
            });
         })
         .catch(() => {
            if (!gone) broken.current();
         });
      return () => {
         gone = true;
         player?.destroy();
      };
   }, [videoId]);

   return (
      <div className="overflow-hidden rounded-[18px] border-2 border-[#7661f9] bg-[#1b1230] shadow-[0_4px_0_#4a35c9]">
         <div className="flex items-center gap-2 bg-[#6b55f7] px-3 py-2">
            <img alt="" className="size-6 rounded-full bg-white object-contain" src="/moodenglogo.png" />
            <span className="text-[14px] font-extrabold tracking-[0.01em] text-white">Moodeng Credit</span>
         </div>
         <div className={`${tall ? 'aspect-[9/16] max-h-[60vh]' : 'aspect-video'} w-full [&_iframe]:size-full`} ref={holder} />
      </div>
   );
}

