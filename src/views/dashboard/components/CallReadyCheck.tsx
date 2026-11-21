import { Home, Lightbulb, Shirt, Video, Wifi } from 'lucide-react';

// "Get ready for your call" — shown before the time list (VideoCallStep) and again on the booked
// screen (ConnectStep). Calls kept failing on the basics: borrowers outside on the street where we
// couldn't hear them, dark rooms, no Zoom installed. Few words per row, one picture.

export const CALL_READY_IMAGE = '/hippos/connect/call-ready.webp';

export const CALL_READY_ITEMS = [
   { icon: Home, title: 'Be inside', hint: 'A quiet room, not the street' },
   { icon: Lightbulb, title: 'Bright room', hint: 'We need to see your face' },
   { icon: Shirt, title: 'Look neat', hint: 'Like a job interview' },
   { icon: Video, title: 'Zoom ready', hint: 'Install it before the call' },
   { icon: Wifi, title: 'Good internet', hint: 'Wi-Fi or strong data' }
] as const;

export function CallReadyList({ compact = false }: { compact?: boolean }) {
   return (
      <ul className={`flex flex-col ${compact ? 'gap-1.5' : 'gap-2.5'}`}>
         {CALL_READY_ITEMS.map(({ icon: Icon, title, hint }) => (
            <li className="flex items-center gap-3 text-left" key={title}>
               <span
                  className={`grid shrink-0 place-items-center rounded-full bg-[#f3ecff] text-[#6b55f7] dark:bg-[#2a1740] dark:text-[#b4a6ff] ${
                     compact ? 'size-7' : 'size-9'
                  }`}
               >
                  <Icon aria-hidden="true" className={compact ? 'size-4' : 'size-[18px]'} strokeWidth={2} />
               </span>
               <span className="flex min-w-0 flex-col">
                  <b className={`${compact ? 'text-[14px]' : 'text-[16px]'} leading-[20px] text-[#594d65] dark:text-[#e8e0f5]`}>{title}</b>
                  {compact ? null : <span className="text-[13px] leading-[18px] text-[#877897]">{hint}</span>}
               </span>
            </li>
         ))}
      </ul>
   );
}

// The full card before picking a time. The "I'm ready" button lives in VideoCallStep's footer so the
// screen keeps one button.
export function CallReadyCard() {
   return (
      <div className="flex flex-col gap-3 rounded-[18px] border-2 border-[#e2dcee] bg-white px-4 py-4 dark:border-[#40354f] dark:bg-[#1b1526]">
         <img
            alt="Moodeng on a video call in a bright room"
            className="mx-auto h-[190px] w-auto rounded-[14px] object-contain"
            decoding="async"
            src={CALL_READY_IMAGE}
         />
         <span className="text-center text-[18px] font-bold leading-[22px] text-[#594d65] dark:text-[#e8e0f5]">Before your call</span>
         <CallReadyList />
      </div>
   );
}

// Small reminder on the booked screen.
export function CallReadyReminder() {
   return (
      <div className="flex w-full flex-col gap-2 rounded-[14px] border-2 border-[#e2dcee] bg-white px-3 py-3 text-left dark:border-[#40354f] dark:bg-[#1b1526]">
         <b className="text-[14px] leading-[19px] text-[#594d65] dark:text-[#e8e0f5]">For your call</b>
         <CallReadyList compact />
      </div>
   );
}
