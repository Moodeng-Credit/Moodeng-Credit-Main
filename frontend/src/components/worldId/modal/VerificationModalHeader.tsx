import { type FC } from 'react';

interface VerificationModalHeaderProps {
   onClose: () => void;
}

export const VerificationModalHeader: FC<VerificationModalHeaderProps> = ({ onClose }) => {
   return (
      <header className="border-b border-border px-6 py-4 relative flex items-center justify-end">
         <div className="flex items-center gap-2">
            <a
               href="https://worldcoin.org"
               target="_blank"
               rel="noopener noreferrer"
               className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
               aria-label="Help"
            >
               <span className="text-sm font-semibold">?</span>
            </a>
            <button
               type="button"
               onClick={onClose}
               className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
               aria-label="Close modal"
            >
               <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
               </svg>
            </button>
         </div>
      </header>
   );
};
