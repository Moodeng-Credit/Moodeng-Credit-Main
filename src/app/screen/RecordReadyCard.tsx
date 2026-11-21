import { PrimaryButton } from '@/views/dashboard/components/connectKit';

// A short "get ready" card before the first video answer (George, 2026-11-21): quiet place, face clear,
// good light. The picture (Gemini-made) shows it without words: a hippo filming itself on a phone on a
// tripod, ring light on, door closed, cat asleep.
const TIPS: Array<[string, string]> = [
   ['🤫', 'Find a quiet place'],
   ['💡', 'Face a light or a window'],
   ['🙂', 'Keep your whole face on the screen'],
   ['📱', 'Hold the phone at eye level']
];

export default function RecordReadyCard({ onReady }: { onReady: () => void }) {
   return (
      <div className="flex flex-col gap-4">
         <img
            alt="A hippo recording itself on a phone with a ring light in a quiet room"
            className="mx-auto aspect-square w-full max-w-[300px] rounded-[20px] object-cover shadow-[0_6px_20px_rgba(91,68,230,0.15)]"
            src="/hippos/prescreen/ready-to-record.webp"
         />
         <p className="text-center text-[18px] font-bold text-[#3b2f4a] dark:text-[#f5f0ff]">Before you record 🎥</p>
         <ul className="flex flex-col gap-2">
            {TIPS.map(([icon, text]) => (
               <li
                  className="flex items-center gap-3 rounded-[14px] bg-[#f4f1fb] px-4 py-3 text-[16px] font-semibold text-[#3b2f4a] dark:bg-[#221a31] dark:text-[#f5f0ff]"
                  key={text}
               >
                  <span className="text-[22px]">{icon}</span>
                  {text}
               </li>
            ))}
         </ul>
         <PrimaryButton onClick={onReady}>I’m ready</PrimaryButton>
      </div>
   );
}
