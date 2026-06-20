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
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2ZM14.18 15.116C13.448 15.116 12.859 14.907 12.413 14.49C12.104 14.202 11.904 13.85 11.81 13.442H18.812C18.74 13.884 18.568 14.41 18.301 15.116H14.18ZM11.812 10.878C11.908 10.497 12.107 10.168 12.413 9.894C12.859 9.472 13.448 9.261 14.18 9.261H18.316C18.58 9.756 18.746 10.283 18.815 10.878H11.812ZM7.394 8.054C7.845 7.315 8.457 6.728 9.232 6.296C10.006 5.862 10.858 5.646 11.788 5.646C12.717 5.646 13.57 5.862 14.344 6.296C14.74 6.517 15.092 6.779 15.402 7.079H12.125C11.383 7.079 10.724 7.225 10.147 7.516C9.57 7.809 9.122 8.209 8.803 8.718C8.579 9.076 8.435 9.464 8.368 9.881H6.757C6.838 9.228 7.05 8.62 7.394 8.054ZM14.344 17.714C13.57 18.148 12.717 18.364 11.788 18.364C10.858 18.364 10.006 18.148 9.232 17.714C8.457 17.279 7.845 16.693 7.394 15.956C7.054 15.397 6.842 14.797 6.758 14.155H8.368C8.435 14.572 8.579 14.959 8.803 15.318C9.122 15.827 9.57 16.228 10.147 16.52C10.724 16.813 11.383 16.957 12.125 16.957H15.377C15.073 17.247 14.728 17.499 14.344 17.717V17.714Z" />
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
