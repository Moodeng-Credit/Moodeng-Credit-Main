import { type ReactNode, useEffect } from 'react';

// Same look as the dashboard's milestone popup (Figma "Milestone_9.23version", milestone_verified_popup):
// dimmed overlay, white-to-lavender card, italic underlined title, gradient pill, round close.
const GRADIENT = 'linear-gradient(77.66deg, #9584ff 0.5%, #6b55f7 98.16%)';
const CLOSE_ICON = '/dashboard-v2/icon-close-large.png';

/** The popup's gradient pill button. */
export function LenderPopupButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
   return (
      <button
         type="button"
         onClick={onClick}
         disabled={disabled}
         className="flex h-[52px] w-full max-w-[346px] items-center justify-center rounded-[35px] px-5 text-[20px] font-semibold tracking-[-0.4px] text-white transition active:scale-[0.99] disabled:opacity-60"
         style={{ backgroundImage: GRADIENT }}
      >
         {children}
      </button>
   );
}

interface Props {
   title: string;
   labelledBy: string;
   onClose: () => void;
   children: ReactNode;
}

/** Frame shared by the lender popups (Funded, iPhone Home Screen push ask). */
export default function LenderPopupShell({ title, labelledBy, onClose, children }: Props) {
   useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
         if (event.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
   }, [onClose]);

   return (
      <div
         className="fixed inset-0 z-[80] flex overflow-y-auto overscroll-contain bg-black/80 px-5 py-6"
         role="dialog"
         aria-modal="true"
         aria-labelledby={labelledBy}
         onClick={onClose}
      >
         <div className="m-auto flex w-full max-w-[400px] flex-col items-center" onClick={(event) => event.stopPropagation()}>
            {/* Usernames run to 45 characters with no spaces, so let them break anywhere and cap at two lines. */}
            <p className="mb-2 line-clamp-2 max-w-[350px] text-center text-[26px] font-black italic leading-9 text-[#4c239f] underline decoration-[#7e6afa] decoration-4 underline-offset-8 [overflow-wrap:anywhere]">
               {title}
            </p>
            <div className="w-full rounded-[26px] bg-gradient-to-b from-[#f3ecff] via-white via-40% to-white shadow-[0_-1px_0_0_#fff]">
               <div className="flex flex-col items-center gap-[9px] px-5 pb-6 pt-[18px] text-center">{children}</div>
            </div>
            <button type="button" onClick={onClose} className="mt-14 h-[50px] w-[50px]" aria-label="Close">
               <img src={CLOSE_ICON} alt="" className="h-[50px] w-[50px]" />
            </button>
         </div>
      </div>
   );
}
