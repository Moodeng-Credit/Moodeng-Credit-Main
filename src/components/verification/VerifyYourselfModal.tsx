import { Check, FileText, Scan } from 'lucide-react';
import { useCallback, useState } from 'react';

import { useNavigate } from 'react-router-dom';

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
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#12071f]/50 px-5" onClick={handleClose}>
         <div
            className="bg-white rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-md-4 items-center"
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
                  icon={<Scan size={18} />}
                  label="World ID (Orb)"
                  description="Fast, privacy-preserving proof you&rsquo;re human"
                  badge="Recommended"
               />
               <OptionCard
                  method="didit"
                  selected={selected === 'didit'}
                  onSelect={() => setSelected('didit')}
                  icon={<FileText size={18} />}
                  label="Traditional KYC"
                  description="Quick ID &amp; selfie check"
               />
            </div>

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
         className="w-full text-left rounded-md-lg border-2 p-4 flex items-center gap-3 transition-all duration-150"
         style={{
            borderColor: selected ? '#6010d2' : '#f0f0f0',
            background: selected ? '#f1e9fd' : '#fff',
         }}
      >
         <div
            className="shrink-0 w-9 h-9 rounded-md-md flex items-center justify-center transition-colors duration-150"
            style={{
               background: selected ? '#6010d2' : '#f2f0f5',
               color: selected ? '#fdfcfd' : '#877897',
            }}
         >
            {icon}
         </div>

         <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
               <span
                  className="text-md-b2 font-semibold"
                  style={{ color: selected ? '#6010d2' : '#040033' }}
               >
                  {label}
               </span>
               {badge && (
                  <span
                     className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                     style={{
                        background: selected ? '#d6bcfa' : '#f2f0f5',
                        color: selected ? '#6010d2' : '#877897',
                     }}
                  >
                     {badge}
                  </span>
               )}
            </div>
            <p className="text-md-b3 text-md-neutral-1000 mt-0.5 leading-snug">{description}</p>
         </div>

         <div
            className="shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-150"
            style={{
               borderColor: selected ? '#6010d2' : '#c0b9c8',
               background: selected ? '#6010d2' : 'transparent',
            }}
         >
            {selected && <Check size={11} strokeWidth={3} color="#fdfcfd" />}
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
