import { Check, FileText } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { SUPPORTED_DIDIT_COUNTRIES } from '@/components/verification/CountryFlags';

type VerifyMethod = 'worldid' | 'didit';

type VerifyYourselfModalProps = {
   isOpen: boolean;
   onClose: () => void;
   returnTo?: string;
};

export default function VerifyYourselfModal({ isOpen, onClose, returnTo }: VerifyYourselfModalProps) {
   const navigate = useNavigate();
   const [selected, setSelected] = useState<VerifyMethod | null>(null);

   const start = useCallback(
      (method: VerifyMethod) => {
         setSelected(null);
         onClose();
         navigate('/verify', { state: { method, returnTo } });
      },
      [navigate, onClose, returnTo]
   );

   const handleContinue = useCallback(() => {
      if (selected) start(selected);
   }, [selected, start]);

   if (!isOpen) {
      return null;
   }

   const handleClose = () => {
      setSelected(null);
      onClose();
   };

   return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#12071f]/50 backdrop-blur-[2px] px-5" onClick={handleClose}>
         <div
            className="bg-md-neutral-100 rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-md-4 items-center overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
         >
            <div className="flex flex-col gap-2 items-center text-center">
               <h2 className="text-md-h4 font-semibold text-md-heading">Verify Yourself</h2>
               <p className="text-md-b1 text-md-neutral-1200">
                  Choose how you&rsquo;d like to verify your identity. You only need to complete one.
               </p>
            </div>

            <div className="flex flex-col gap-3 w-full">
               <OptionCard
                  method="worldid"
                  selected={selected === 'worldid'}
                  onSelect={() => setSelected('worldid')}
                  icon={
                     <svg width="22" height="22" viewBox="98 32 250 250" fill="currentColor" aria-hidden="true">
                        <path d="M327.6,115.2c-3-7.5-6.8-14.6-11.3-21.3c-20.3-30-54.7-49.7-93.6-49.7c-62.4,0-112.9,50.6-112.9,112.9c0,62.4,50.6,113,112.9,113c39,0,73.3-19.7,93.6-49.7c4.5-6.6,8.2-13.7,11.3-21.2c5.2-13,8.1-27.2,8.1-42C335.6,142.4,332.8,128.2,327.6,115.2z M312.5,145.7H183.2c2-7,5.7-13.2,10.7-18.1c7.6-7.6,18.1-12.3,29.7-12.3H303C307.9,124.6,311.1,134.8,312.5,145.7z M222.1,66.1c25.7,0,49,10.7,65.6,27.9h-61.3c-17.5,0-33.3,7.1-44.7,18.5c-8.9,8.9-15.1,20.3-17.4,33.2h-32.5C137.4,100.8,175.7,66.1,222.1,66.1z M222.1,248.4c-46.4,0-84.7-34.7-90.4-79.6h32.5c5.4,29.4,31.2,51.7,62.2,51.7h61.3C271.2,237.7,247.9,248.4,222.1,248.4z M223.6,199.3c-19.2,0-35.4-12.9-40.4-30.5h129.3c-1.4,10.9-4.7,21.1-9.5,30.5H223.6z" />
                     </svg>
                  }
                  label="World ID (Orb)"
                  description="Fast, privacy-preserving proof you&rsquo;re human. Requires Orb verification."
               />
               <OptionCard
                  method="didit"
                  selected={selected === 'didit'}
                  onSelect={() => setSelected('didit')}
                  icon={<FileText size={18} />}
                  label="Traditional KYC"
                  description="Quick ID &amp; selfie check — available in select countries"
               />
            </div>

            {selected === 'didit' && (
               <div className="flex flex-col gap-3 w-full">
                  <p className="text-md-b3 font-semibold uppercase tracking-[0.08em] text-md-neutral-700 text-center">
                     Supported countries
                  </p>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-8 px-4 w-full">
                     {SUPPORTED_DIDIT_COUNTRIES.map(({ code, name, Flag }) => (
                        <div key={code} className="flex items-center gap-3">
                           <div className="shrink-0 overflow-hidden rounded-[3px] shadow-sm shadow-black/10">
                              <Flag className="w-[30px] h-5 block" />
                           </div>
                           <span className="text-md-b2 font-medium text-md-heading">{name}</span>
                        </div>
                     ))}
                  </div>
                  <p className="text-md-b3 text-md-neutral-700 text-center">
                     Not from these countries?{' '}
                     <button
                        type="button"
                        className="font-semibold text-md-primary-1200 underline underline-offset-2"
                        onClick={() => setSelected('worldid')}
                     >
                        Use World ID instead
                     </button>
                  </p>
               </div>
            )}

            <div className="flex flex-col gap-2 w-full">
               <button
                  type="button"
                  disabled={!selected}
                  onClick={handleContinue}
                  className={`flex items-center justify-center w-full px-md-4 py-md-3 rounded-md-lg font-semibold text-md-b1 transition-colors active:scale-[0.99] disabled:cursor-not-allowed ${selected ? 'bg-md-primary-1200 text-md-neutral-100' : 'bg-md-neutral-400 text-md-neutral-700'}`}
               >
                  Continue
               </button>
               <button
                  type="button"
                  onClick={handleClose}
                  className="text-md-b2 font-medium text-md-neutral-700 underline underline-offset-2 py-1"
               >
                  Cancel
               </button>
            </div>
         </div>
      </div>
   );
}

function OptionCard({
   method,
   selected,
   onSelect,
   icon,
   label,
   description,
   badge,
}: {
   method: VerifyMethod;
   selected: boolean;
   onSelect: () => void;
   icon: React.ReactNode;
   label: string;
   description: string;
   badge?: string;
}) {
   return (
      <button
         type="button"
         onClick={onSelect}
         className={`w-full text-left rounded-md-lg border-2 p-4 flex items-center gap-3 transition-all duration-150 ${
            selected
               ? 'border-md-primary-1200 bg-md-primary-100'
               : 'border-md-neutral-300 bg-md-neutral-100'
         }`}
      >
         <div
            className={`shrink-0 w-9 h-9 rounded-md-md flex items-center justify-center transition-colors duration-150 ${
               selected
                  ? 'bg-md-primary-1200 text-md-neutral-100'
                  : 'bg-md-neutral-200 text-md-neutral-700'
            }`}
         >
            {icon}
         </div>

         <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
               <span
                  className={`text-md-b2 font-semibold ${
                     selected ? 'text-md-primary-1200' : 'text-md-heading'
                  }`}
               >
                  {label}
               </span>
               {badge && (
                  <span
                     className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        selected
                           ? 'bg-md-primary-300 text-md-primary-1200'
                           : 'bg-md-neutral-200 text-md-neutral-700'
                     }`}
                  >
                     {badge}
                  </span>
               )}
            </div>
            <p className="text-md-b3 text-md-neutral-1000 mt-0.5 leading-snug">{description}</p>
         </div>

         <div
            className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-150 ${
               selected
                  ? 'border-md-primary-1200 bg-md-primary-1200'
                  : 'border-md-neutral-600 bg-transparent'
            }`}
         >
            {selected && <Check size={11} strokeWidth={3} className="text-md-neutral-100" />}
         </div>
      </button>
   );
}

/**
 * Convenience hook for triggering the verification chooser from any bespoke button. Render
 * `modal` somewhere in your tree and call `open` from your button.
 *
 * `returnTo` defaults to the caller's current path so the user lands back where they started.
 */
export function useVerifyYourself(returnTo?: string) {
   const [isOpen, setIsOpen] = useState(false);
   const open = useCallback(() => setIsOpen(true), []);
   const close = useCallback(() => setIsOpen(false), []);
   const effectiveReturnTo = returnTo ?? (typeof window !== 'undefined' ? window.location.pathname : undefined);
   const modal = <VerifyYourselfModal isOpen={isOpen} onClose={close} returnTo={effectiveReturnTo} />;
   return { open, close, isOpen, modal };
}
