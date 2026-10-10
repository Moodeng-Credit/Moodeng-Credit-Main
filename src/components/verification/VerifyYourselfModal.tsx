import { ArrowLeft, ArrowRight, ChevronDown, Download, MapPin } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { SUPPORTED_DIDIT_COUNTRIES } from '@/components/verification/CountryFlags';
import { EXTERNAL_LINKS } from '@/config/externalLinks';
import { PRE_KYC_CONNECT_PATH, usePreKycGate } from '@/hooks/usePreKycGate';
import { clearVerifyFlow, type VerifyMethod } from '@/lib/verifyFlow';

type VerifyYourselfModalProps = {
   isOpen: boolean;
   onClose: () => void;
   returnTo?: string;
};

// Countries eligible for World ID passport verification: NFC-enabled passports from these
// countries, while the holder is currently located in one of them (per World support docs).
const PASSPORT_COUNTRIES = [
   '🇺🇸 United States',
   '🇬🇧 United Kingdom',
   '🇯🇵 Japan',
   '🇰🇷 South Korea',
   '🇹🇼 Taiwan',
   '🇲🇾 Malaysia',
   '🇲🇽 Mexico',
   '🇨🇷 Costa Rica',
   '🇵🇦 Panama',
   '🇨🇴 Colombia',
   '🇨🇱 Chile',
   '🇦🇷 Argentina'
];

// Countries with Orb locations, per World's live map (world.org/find-orb).
// Curated snapshot — availability changes, so the UI always links to the live map too.
const ORB_COUNTRIES = [
   '🇺🇸 United States',
   '🇯🇵 Japan',
   '🇰🇷 South Korea',
   '🇸🇬 Singapore',
   '🇲🇾 Malaysia',
   '🇹🇭 Thailand',
   '🇵🇭 Philippines',
   '🇩🇪 Germany',
   '🇦🇹 Austria',
   '🇵🇱 Poland',
   '🇲🇽 Mexico',
   '🇬🇹 Guatemala',
   '🇨🇷 Costa Rica',
   '🇵🇦 Panama',
   '🇨🇴 Colombia',
   '🇪🇨 Ecuador',
   '🇵🇪 Peru',
   '🇧🇷 Brazil',
   '🇨🇱 Chile',
   '🇦🇷 Argentina'
];

export const WorldIdOrb = ({ size = 22 }: { size?: number }) => (
   <svg width={size} height={size} viewBox="98 32 250 250" fill="currentColor" aria-hidden="true">
      <path d="M327.6,115.2c-3-7.5-6.8-14.6-11.3-21.3c-20.3-30-54.7-49.7-93.6-49.7c-62.4,0-112.9,50.6-112.9,112.9c0,62.4,50.6,113,112.9,113c39,0,73.3-19.7,93.6-49.7c4.5-6.6,8.2-13.7,11.3-21.2c5.2-13,8.1-27.2,8.1-42C335.6,142.4,332.8,128.2,327.6,115.2z M312.5,145.7H183.2c2-7,5.7-13.2,10.7-18.1c7.6-7.6,18.1-12.3,29.7-12.3H303C307.9,124.6,311.1,134.8,312.5,145.7z M222.1,66.1c25.7,0,49,10.7,65.6,27.9h-61.3c-17.5,0-33.3,7.1-44.7,18.5c-8.9,8.9-15.1,20.3-17.4,33.2h-32.5C137.4,100.8,175.7,66.1,222.1,66.1z M222.1,248.4c-46.4,0-84.7-34.7-90.4-79.6h32.5c5.4,29.4,31.2,51.7,62.2,51.7h61.3C271.2,237.7,247.9,248.4,222.1,248.4z M223.6,199.3c-19.2,0-35.4-12.9-40.4-30.5h129.3c-1.4,10.9-4.7,21.1-9.5,30.5H223.6z" />
   </svg>
);

export default function VerifyYourselfModal(props: VerifyYourselfModalProps) {
   // Mounted only while open, so pages that keep a closed modal around never run its checks.
   return props.isOpen ? <OpenVerifyYourselfModal {...props} /> : null;
}

function OpenVerifyYourselfModal({ isOpen, onClose, returnTo }: VerifyYourselfModalProps) {
   const navigate = useNavigate();
   const [step, setStep] = useState<'choose' | 'orb-info' | 'passport-info'>('choose');
   const [showCountries, setShowCountries] = useState(false);
   const preKycGate = usePreKycGate();

   // Not met the team yet (pre-KYC gate): every "Verify" button leads to Messenger + the intro call
   // first, so the chooser never opens — /onboarding/connect sends them on to KYC once approved.
   useEffect(() => {
      if (!isOpen || !preKycGate.isGated) return;
      onClose();
      navigate(PRE_KYC_CONNECT_PATH, { state: { returnTo } });
   }, [isOpen, preKycGate.isGated, onClose, navigate, returnTo]);

   const start = useCallback(
      (method: VerifyMethod) => {
         setStep('choose');
         setShowCountries(false);
         onClose();
         // Start clean: drop any earlier saved flow so a fresh tap of e.g. "Verify Your ID"
         // can never be resumed into a stale World-ID/liveness attempt (which points at the
         // biometric workflow and fails for a first-timer).
         clearVerifyFlow();
         navigate('/verify', { state: { method, returnTo } });
      },
      [navigate, onClose, returnTo]
   );

   const close = useCallback(() => {
      setStep('choose');
      setShowCountries(false);
      onClose();
   }, [onClose]);

   if (!isOpen || preKycGate.isGated) {
      return null;
   }

   if (step === 'passport-info') {
      return (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#12071f]/50 backdrop-blur-[2px] px-5" onClick={close}>
            <div
               className="bg-md-neutral-100 rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-md-4 overflow-y-auto max-h-[90vh]"
               onClick={(e) => e.stopPropagation()}
            >
               <div className="flex flex-col gap-2 items-center text-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-md-neutral-200 text-md-heading">
                     <WorldIdOrb size={28} />
                  </div>
                  <h2 className="text-md-h4 font-semibold text-md-heading">World ID Passport</h2>
                  <p className="text-md-b2 text-md-neutral-1200">
                     Verify by scanning your passport with your phone in the World App — no Orb visit
                     needed. You need an <strong>NFC-enabled (biometric) passport</strong> from one of
                     these countries, and you must currently be in one of them:
                  </p>
               </div>

               <div className="grid grid-cols-2 gap-y-2 gap-x-4 w-fit mx-auto">
                  {PASSPORT_COUNTRIES.map((country) => (
                     <span key={country} className="text-md-b2 text-md-heading">
                        {country}
                     </span>
                  ))}
               </div>

               <p className="text-md-b3 text-md-neutral-700 text-center">
                  Look for the chip symbol on your passport cover. You&rsquo;ll also need a phone with NFC
                  (most modern phones) and the World App installed.
               </p>

               <button
                  type="button"
                  onClick={() => start('worldid-passport')}
                  className="w-full rounded-md-lg bg-md-primary-1200 text-md-neutral-100 p-4 text-md-b1 font-semibold transition-all duration-150 active:scale-[0.99]"
               >
                  I&rsquo;m eligible — Continue
               </button>

               <div className="flex flex-col gap-1.5 items-center">
                  <a
                     href={EXTERNAL_LINKS.worldcoin.downloadApp}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="text-md-b2 font-medium text-md-neutral-1000 underline underline-offset-2"
                  >
                     Get the World App
                  </a>
                  <a
                     href={EXTERNAL_LINKS.worldcoin.passportHelp}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="text-md-b2 font-medium text-md-neutral-1000 underline underline-offset-2"
                  >
                     Need help with this step?
                  </a>
               </div>

               <button
                  type="button"
                  onClick={() => setStep('orb-info')}
                  className="flex items-center gap-1.5 text-md-b2 font-medium text-md-neutral-700 py-1 self-center"
               >
                  <ArrowLeft size={16} />
                  Back
               </button>
            </div>
         </div>
      );
   }

   if (step === 'orb-info') {
      return (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#12071f]/50 backdrop-blur-[2px] px-5" onClick={close}>
            <div
               className="bg-md-neutral-100 rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-md-4 overflow-y-auto max-h-[90vh]"
               onClick={(e) => e.stopPropagation()}
            >
               <div className="flex flex-col gap-2 items-center text-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-md-neutral-200 text-md-heading">
                     <WorldIdOrb size={28} />
                  </div>
                  <h2 className="text-md-h4 font-semibold text-md-heading">Verify with World ID</h2>
                  <p className="text-md-b2 text-md-neutral-1200">
                     World ID is verified in person at an Orb — a physical device available only in certain
                     countries — or with a passport scan in the World App. Pick the option that matches you.
                  </p>
               </div>

               <div className="flex flex-col gap-2 w-full">
                  <button
                     type="button"
                     onClick={() => start('worldid')}
                     className="w-full rounded-md-lg bg-md-primary-1200 text-md-neutral-100 p-4 text-md-b1 font-semibold transition-all duration-150 active:scale-[0.99]"
                  >
                     I&rsquo;ve been verified at an Orb
                  </button>
                  <button
                     type="button"
                     onClick={() => setStep('passport-info')}
                     className="w-full rounded-md-lg border-2 border-md-primary-1200 text-md-primary-1200 p-4 text-md-b1 font-semibold transition-all duration-150 active:scale-[0.99]"
                  >
                     I&rsquo;ll verify with my passport
                  </button>
               </div>

               <div className="flex flex-col gap-2 w-full">
                  <p className="text-md-b3 font-semibold uppercase tracking-[0.08em] text-md-neutral-700 text-center">
                     New to World ID?
                  </p>
                  <a
                     href={EXTERNAL_LINKS.worldcoin.downloadApp}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="w-full rounded-md-lg border border-md-neutral-300 p-3.5 flex items-center gap-3 text-md-b2 font-medium text-md-heading transition-colors hover:bg-md-neutral-200"
                  >
                     <Download size={18} className="shrink-0 text-md-neutral-700" />
                     1. Download the World App
                  </a>
                  <a
                     href={EXTERNAL_LINKS.worldcoin.findOrb}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="w-full rounded-md-lg border border-md-neutral-300 p-3.5 flex items-center gap-3 text-md-b2 font-medium text-md-heading transition-colors hover:bg-md-neutral-200"
                  >
                     <MapPin size={18} className="shrink-0 text-md-neutral-700" />
                     2. Find an Orb near you
                  </a>
               </div>

               <div className="flex flex-col gap-2 w-full">
                  <button
                     type="button"
                     onClick={() => setShowCountries((v) => !v)}
                     className="flex items-center justify-center gap-1.5 text-md-b2 font-medium text-md-neutral-1000 py-1"
                  >
                     Countries with Orb locations
                     <ChevronDown size={16} className={`transition-transform ${showCountries ? 'rotate-180' : ''}`} />
                  </button>
                  {showCountries ? (
                     <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 w-fit mx-auto">
                           {ORB_COUNTRIES.map((country) => (
                              <span key={country} className="text-md-b2 text-md-heading">
                                 {country}
                              </span>
                           ))}
                        </div>
                        <p className="text-md-b3 text-md-neutral-700 text-center">
                           Availability changes —{' '}
                           <a
                              href={EXTERNAL_LINKS.worldcoin.findOrb}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline underline-offset-2"
                           >
                              check the live map
                           </a>{' '}
                           for exact locations.
                        </p>
                     </div>
                  ) : null}
               </div>

               <button
                  type="button"
                  onClick={() => setStep('choose')}
                  className="flex items-center gap-1.5 text-md-b2 font-medium text-md-neutral-700 py-1 self-center"
               >
                  <ArrowLeft size={16} />
                  Back to verification options
               </button>
            </div>
         </div>
      );
   }

   return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#12071f]/50 backdrop-blur-[2px] px-5" onClick={close}>
         <div
            className="bg-md-neutral-100 rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-md-4 overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
         >
            <div className="flex flex-col gap-2 items-center text-center">
               <h2 className="text-md-h4 font-semibold text-md-heading">Verify Yourself</h2>
               <p className="text-md-b1 text-md-neutral-1200">
                  A one-time ID check so lenders know you're a real person — it takes about 3 minutes.
               </p>
            </div>

            {/* Primary, recommended path: national ID + selfie check via Didit. One block that reads
                top to bottom — what it is, where it works, one solid button. Earlier the highlighted
                card looked "already selected" and the World ID card below it looked like the only
                button, so people in supported countries (Taiwan, Philippines…) tapped World ID. */}
            <div className="w-full rounded-md-lg border border-md-neutral-300 p-4 flex flex-col gap-md-3">
               <div className="flex items-center gap-3">
                  {/* Same 40px soft tile as the account menu's 3D icons; the card is wide, so 28px art reads the same size. */}
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md-input bg-md-primary-100">
                     <img src="/icons/national-id-3d.png" alt="" aria-hidden="true" className="size-7 object-contain" />
                  </span>
                  <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-md-b1 font-semibold text-md-heading">Verify with your National ID</span>
                        {/* A quiet tag, not a solid purple pill — that read as a second button. */}
                        <span className="inline-flex items-center text-md-b3 font-medium px-2 py-0.5 rounded-full bg-md-green-100 text-md-green-900">
                           Recommended
                        </span>
                     </div>
                     <p className="text-md-b3 text-md-neutral-1000 mt-0.5 leading-snug">
                        A photo of your ID and a quick selfie. Works in:
                     </p>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-y-3 gap-x-6 w-fit mx-auto">
                  {SUPPORTED_DIDIT_COUNTRIES.map(({ code, name, Flag }) => (
                     <div key={code} className="flex items-center gap-3">
                        <div className="shrink-0 overflow-hidden rounded-[3px] shadow-sm shadow-black/10">
                           <Flag className="w-[30px] h-5 block" />
                        </div>
                        <span className="text-md-b2 font-medium text-md-heading">{name}</span>
                     </div>
                  ))}
               </div>

               <button
                  type="button"
                  onClick={() => start('didit')}
                  className="w-full rounded-md-lg bg-md-primary-1200 text-md-neutral-100 p-4 flex items-center justify-center gap-2 text-md-b1 font-semibold transition-all duration-150 active:scale-[0.99]"
               >
                  Continue with National ID
                  <ArrowRight size={18} aria-hidden="true" />
               </button>
            </div>

            {/* Secondary path: World ID (Orb/passport), kept as a quiet text link so it can't be
                mistaken for the main button. */}
            <div className="flex flex-col items-center gap-1 text-center">
               <p className="text-md-b3 text-md-neutral-700">Not in one of these countries?</p>
               <button
                  type="button"
                  onClick={() => setStep('orb-info')}
                  className="inline-flex items-center gap-1.5 text-md-b2 font-medium text-md-neutral-1000 underline underline-offset-2 py-1"
               >
                  <WorldIdOrb size={16} />
                  Use World ID instead
               </button>
               <p className="text-md-b3 text-md-neutral-700">Only if you already have the World App.</p>
            </div>

            <button
               type="button"
               onClick={close}
               className="text-md-b2 font-medium text-md-neutral-700 underline underline-offset-2 py-1 self-center"
            >
               Cancel
            </button>
         </div>
      </div>
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
