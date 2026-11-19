import { useEffect, useRef } from 'react';

// The Moodeng-framed YouTube player used by the pre-screening (/screen) and journey v2
// (/onboarding/verify). `onEnded` fires when the video plays to the end; `onBroken` if it can't load.
//
// A plain YouTube embed iframe, so the video shows even when YouTube's iframe_api script is slow or
// blocked (Nov 2026: most Android phones got an empty purple box). "Ended" comes from the embed's own
// postMessage events (enablejsapi=1), no extra script needed.

const YT_ORIGINS = ['https://www.youtube.com', 'https://www.youtube-nocookie.com'];
const NO_REPLY_MS = 15000;

type YTMessage = { event?: string; info?: unknown };

const parse = (raw: unknown): YTMessage | null => {
   if (typeof raw === 'string') {
      try {
         return JSON.parse(raw) as YTMessage;
      } catch {
         return null;
      }
   }
   return raw && typeof raw === 'object' ? (raw as YTMessage) : null;
};

/** The Moodeng-framed player. `onEnded` fires when the video plays to the end; `onBroken` if it can't load. */
export default function BrandedVideo({ videoId, tall = true, onEnded, onBroken }: { videoId: string; tall?: boolean; onEnded: () => void; onBroken: () => void }) {
   const frame = useRef<HTMLIFrameElement>(null);
   const ended = useRef(onEnded);
   const broken = useRef(onBroken);
   ended.current = onEnded;
   broken.current = onBroken;

   useEffect(() => {
      let heard = false;
      let done = false;
      const finish = () => {
         if (done) return;
         done = true;
         ended.current();
      };
      const onMessage = (e: MessageEvent) => {
         if (!YT_ORIGINS.includes(e.origin) || e.source !== frame.current?.contentWindow) return;
         const msg = parse(e.data);
         if (!msg?.event) return;
         heard = true;
         if (msg.event === 'onError') return broken.current();
         if (msg.event === 'onStateChange' && msg.info === 0) return finish();
         if (msg.event === 'infoDelivery' && (msg.info as { playerState?: number } | null)?.playerState === 0) finish();
      };
      window.addEventListener('message', onMessage);
      // Ask the embed to send its events; repeat until it answers (it ignores us before it's ready).
      const listen = () => frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: videoId }), '*');
      const poll = window.setInterval(() => (heard ? window.clearInterval(poll) : listen()), 500);
      // Never heard from YouTube: let them continue rather than trap them.
      const giveUp = window.setTimeout(() => {
         if (!heard) broken.current();
      }, NO_REPLY_MS);
      return () => {
         window.removeEventListener('message', onMessage);
         window.clearInterval(poll);
         window.clearTimeout(giveUp);
      };
   }, [videoId]);

   return (
      <div className="overflow-hidden rounded-[18px] border-2 border-[#7661f9] bg-[#1b1230] shadow-[0_4px_0_#4a35c9]">
         <div className="flex items-center gap-2 bg-[#6b55f7] px-3 py-2">
            <img alt="" className="size-6 rounded-full bg-white object-contain" src="/moodenglogo.png" />
            <span className="text-[14px] font-extrabold tracking-[0.01em] text-white">Moodeng Credit</span>
         </div>
         <div className={`${tall ? 'aspect-[9/16] max-h-[60vh]' : 'aspect-video'} w-full`}>
            <iframe
               allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
               allowFullScreen
               className="size-full"
               key={videoId}
               ref={frame}
               referrerPolicy="strict-origin-when-cross-origin"
               src={`https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1&enablejsapi=1`}
               title="Moodeng video"
            />
         </div>
      </div>
   );
}
