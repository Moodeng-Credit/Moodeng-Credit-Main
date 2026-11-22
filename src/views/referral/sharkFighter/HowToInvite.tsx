import { inviteMessage } from '@/views/referral/sharkFighter/inviteMessage';

// "How to invite" (Figma "How to invite – /affiliate"): the link, the code for friends who sign up without
// it, the before-first-loan rule, and a ready Taglish message. One Share button; Copy is a text link.

const PRIMARY_GRADIENT = 'linear-gradient(77.66deg, #9584ff 0.5%, #6b55f7 98.16%)';

const displayLink = (link: string) => link.replace(/^https?:\/\//, '');

export default function HowToInvite({
   code,
   link,
   rewardUsd,
   onShare,
   onCopy
}: {
   code: string;
   link: string;
   rewardUsd: number;
   onShare: () => void;
   onCopy: () => void;
}) {
   const steps: { title: string; body: string; chip?: { text: string; big?: boolean } }[] = [
      { title: 'Send your link', body: 'Tap Share. Your code is already inside the link.', chip: { text: displayLink(link) } },
      { title: 'Friend signs up', body: 'They open the link and make an account. Done, you’re linked.' },
      { title: 'No link? Give your code', body: 'On the first screen “Who invited you?” they type:', chip: { text: code, big: true } },
      { title: 'Friend repays on time', body: `You get a stamp + $${rewardUsd} 🎉` }
   ];
   return (
      <section
         className="mt-6 rounded-[20px] bg-white px-5 py-5 shadow-[0_2px_8px_rgba(28,5,61,0.08)] dark:bg-dv2-card"
         aria-label="How to invite"
      >
         <h2 className="text-[22px] font-black italic text-[#4c239f] dark:text-[#c4b8ff]">How to invite 🦛</h2>
         <ol className="mt-4 flex flex-col">
            {steps.map((step, index) => (
               <li key={step.title} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < steps.length - 1 ? (
                     <span className="absolute bottom-0 left-[15px] top-9 w-0.5 bg-[#e4dafb] dark:bg-dv2-tab" aria-hidden="true" />
                  ) : null}
                  <span
                     className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[16px] font-black text-white"
                     style={{ backgroundImage: PRIMARY_GRADIENT }}
                  >
                     {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 pt-1">
                     <p className="text-[17px] font-bold text-[#2a1e5c] dark:text-white">{step.title}</p>
                     <p className="mt-0.5 text-[14px] leading-5 text-[#594d65] dark:text-[#d9cfe6]">{step.body}</p>
                     {step.chip ? (
                        <p
                           className={`mt-2 inline-block break-all rounded-[10px] border border-dashed border-[#b9aeff] bg-[#f4f1fb] px-3 py-1.5 dark:bg-dv2-tab ${
                              step.chip.big
                                 ? 'text-[18px] font-black tracking-wide text-[#2a1e5c] dark:text-white'
                                 : 'text-[13px] font-semibold text-[#6b55f7] dark:text-[#b3a6ff]'
                           }`}
                        >
                           {step.chip.text}
                        </p>
                     ) : null}
                  </div>
               </li>
            ))}
         </ol>
         <p className="mt-4 rounded-[12px] border border-[#f1d58a] bg-[#fff8e1] px-3.5 py-3 text-[13px] font-semibold text-[#6b4a00] dark:border-[#5a4818] dark:bg-[#2a2210] dark:text-[#ffe27a]">
            ⚠️ The code must go in before their first loan. It can’t be added later.
         </p>
         <p className="mt-5 text-[15px] font-bold text-[#2a1e5c] dark:text-white">Message to send</p>
         <p className="mt-2 whitespace-pre-line rounded-[18px] rounded-bl-[4px] bg-[#efe8ff] px-3.5 py-3 text-[13px] leading-[18px] text-[#2a1e5c] dark:bg-dv2-tab dark:text-[#e6def2]">
            {inviteMessage(code, link)}
         </p>
         <button
            type="button"
            onClick={onShare}
            className="mt-4 flex h-[52px] w-full items-center justify-center rounded-[35px] text-[18px] font-semibold text-white active:scale-[0.99]"
            style={{ backgroundImage: PRIMARY_GRADIENT }}
         >
            Share message
         </button>
         <button
            type="button"
            onClick={onCopy}
            className="mx-auto mt-3 block text-[14px] font-semibold text-[#6b55f7] underline underline-offset-2 dark:text-[#b3a6ff]"
         >
            Copy message instead
         </button>
      </section>
   );
}
