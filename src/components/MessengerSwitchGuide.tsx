import { RING, TAP_KEYFRAMES } from '@/components/guideStyles';
import { Step, TapFinger } from '@/components/MenuGuide';

// iPhone inside the Facebook app: nothing on the page can open Messenger from there (the app ignores
// the link), so instead of an "Open Messenger" button that does nothing, this shows how to get to our
// chat by hand, drawn the same way as the Safari guide (MenuGuide): small pictures, the spot to tap
// ringed, a tapping finger. Pictures, not controls; tapping anywhere closes it.

export default function MessengerSwitchGuide({ code, onClose }: { code: string; onClose: () => void }) {
   return (
      <div
         aria-labelledby="messenger-switch-guide-title"
         aria-modal="true"
         className="connect-ui fixed inset-0 z-[1002] flex flex-col items-center overflow-y-auto bg-[#120a1f] px-5 pb-6 pt-2 text-left text-white"
         onClick={onClose}
         role="dialog"
      >
         <style>{TAP_KEYFRAMES}</style>
         <div className="flex w-full max-w-[380px] items-end justify-between gap-2">
            <p id="messenger-switch-guide-title" className="pb-2 text-[22px] font-extrabold leading-[28px]">
               Send your code on Messenger
            </p>
            <img alt="" className="pointer-events-none mr-4 h-28 w-auto shrink-0" src="/hippos/connect/code-copied.png" />
         </div>
         <div className="mt-3 flex w-full max-w-[380px] flex-col gap-4">
            <Step n={1} title="Open your Messenger app">
               {/* A home screen row: other apps faded, Messenger ringed. */}
               <div className="relative flex items-center justify-around rounded-xl bg-gradient-to-b from-[#3b2a63] to-[#2a1d48] px-3 py-3">
                  {[0, 1].map((i) => (
                     <span className="size-11 rounded-[12px] bg-white/25" key={`a-${i}`} />
                  ))}
                  <span className={`flex size-11 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#0099ff] via-[#a033ff] to-[#ff5c87] ${RING.replace('ring-offset-white', 'ring-offset-[#2a1d48]')}`}>
                     <i aria-hidden="true" className="fab fa-facebook-messenger text-[26px] leading-none text-white" />
                  </span>
                  <span className="size-11 rounded-[12px] bg-white/25" />
                  <TapFinger left="calc(62.5% + 4px)" top="58%" />
               </div>
            </Step>

            <Step n={2} title="Search “Moodeng Credit”">
               <div className="relative flex flex-col gap-2 rounded-xl bg-white px-3 py-2.5 text-[#1c1c1e]">
                  <span className="rounded-full bg-[#f0f0f2] px-3 py-1.5 text-[14px] text-[#8e8e93]">🔍 Moodeng Credit</span>
                  <span className={`flex items-center gap-2 rounded-lg px-1.5 py-1 text-[15px] font-semibold ${RING}`}>
                     <img alt="" className="size-8 rounded-full bg-[#fff4d6] object-contain" src="/hippos/connect/hello.png" />
                     Moodeng Credit
                  </span>
                  <TapFinger left="45%" top="74%" />
               </div>
            </Step>

            <Step n={3} title="Paste the code, then Send">
               <div className="relative flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-[#1c1c1e]">
                  <span className="flex-1 rounded-full bg-[#f0f0f2] px-3 py-1.5 text-[15px] font-bold tracking-wide">{code}</span>
                  <span className={`flex size-8 items-center justify-center rounded-full bg-[#0866FF] text-[15px] text-white ${RING}`}>➤</span>
                  <TapFinger left="calc(100% - 28px)" top="50%" />
               </div>
            </Step>

            <Step n={4} title="Come back to Facebook. It turns green by itself." />
         </div>
         <button
            className="mt-auto min-h-[48px] w-full max-w-[400px] rounded-full border-2 border-white/40 text-[16px] font-bold text-white"
            onClick={onClose}
            type="button"
         >
            Got it
         </button>
      </div>
   );
}
