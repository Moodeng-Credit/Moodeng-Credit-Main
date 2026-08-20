import { useEffect, useState } from 'react';

import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { useMfa } from '@/hooks/useMfa';

import { SettingsGroup } from '@/views/account/AccountSettings';

// ─── Enroll TOTP modal ───

function EnrollTotpModal({ isOpen, onClose, onEnrolled }: { isOpen: boolean; onClose: () => void; onEnrolled: () => void }) {
   const { enrollTotp, verifyTotp, cancelEnrollment } = useMfa();
   const { showToast } = useToast();

   const [step, setStep] = useState<'loading' | 'scan' | 'error'>('loading');
   const [factorId, setFactorId] = useState('');
   const [qrCode, setQrCode] = useState('');
   const [secret, setSecret] = useState('');
   const [code, setCode] = useState('');
   const [error, setError] = useState('');
   const [isSubmitting, setIsSubmitting] = useState(false);

   const startEnrollment = async () => {
      setStep('loading');
      setError('');
      try {
         const data = await enrollTotp('Authenticator app');
         setFactorId(data.id);
         setQrCode(data.totp.qr_code);
         setSecret(data.totp.secret);
         setStep('scan');
      } catch (enrollError) {
         setError(enrollError instanceof Error ? enrollError.message : 'Failed to start setup');
         setStep('error');
      }
   };

   const reset = () => {
      setStep('loading');
      setFactorId('');
      setQrCode('');
      setSecret('');
      setCode('');
      setError('');
   };

   useEffect(() => {
      if (isOpen) void startEnrollment();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isOpen]);

   const handleClose = () => {
      if (isSubmitting) return;
      // Abandon the unverified factor rather than leaving it enrolled but unconfirmed —
      // Supabase caps factors per user, so a stray unverified one shouldn't eat that quota.
      if (factorId) void cancelEnrollment(factorId);
      reset();
      onClose();
   };

   const handleVerify = async () => {
      if (code.length !== 6) {
         setError('Enter the 6-digit code from your authenticator app');
         return;
      }

      setError('');
      setIsSubmitting(true);
      try {
         await verifyTotp(factorId, code);
         showToast(TOAST_TYPES.SUCCESS, 'Authenticator app enabled', "You'll need a code from it to sign in from now on.");
         reset();
         onEnrolled();
         onClose();
      } catch (verifyError) {
         setError(verifyError instanceof Error ? verifyError.message : 'That code did not work. Try again.');
      } finally {
         setIsSubmitting(false);
      }
   };

   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#12071f]/50 px-5" onClick={handleClose}>
         <div
            className="bg-white rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-md-3 items-center"
            onClick={(e) => e.stopPropagation()}
         >
            {step === 'loading' ? (
               <div className="flex flex-col items-center gap-md-3 py-md-4">
                  <p className="text-md-b1 text-md-neutral-1200">Setting up authenticator app...</p>
               </div>
            ) : null}

            {step === 'error' ? (
               <div className="flex flex-col gap-md-3 items-center w-full">
                  <p className="text-md-b3 text-md-red-400 text-center w-full">{error}</p>
                  <button
                     type="button"
                     onClick={handleClose}
                     className="w-full py-md-3 px-md-4 border border-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-primary-1200"
                  >
                     Close
                  </button>
               </div>
            ) : null}

            {step === 'scan' ? (
               <>
                  <div className="flex flex-col gap-md-3 items-center w-full">
                     <div className="flex flex-col gap-2 items-center text-center">
                        <h2 className="text-md-h4 font-semibold text-md-heading">Set up authenticator app</h2>
                        <p className="text-md-b1 text-md-neutral-1200">
                           Scan this QR code with Google Authenticator, Authy, or 1Password, then enter the 6-digit code it shows.
                        </p>
                     </div>
                     {qrCode ? (
                        <img
                           src={qrCode}
                           alt="Scan with your authenticator app"
                           className="h-48 w-48 rounded-md-md border border-md-neutral-600"
                        />
                     ) : null}
                     <div className="w-full">
                        <p className="text-md-b3 font-semibold text-md-heading mb-1">Can't scan? Enter this code manually:</p>
                        <p className="w-full break-all rounded-md-input bg-md-neutral-200 px-md-3 py-md-2 text-md-b2 font-mono text-md-neutral-1200">
                           {secret}
                        </p>
                     </div>
                     <div className="flex flex-col gap-md-1 w-full">
                        <p className="text-md-b2 font-semibold text-md-heading">6-digit code</p>
                        <input
                           type="text"
                           inputMode="numeric"
                           autoComplete="one-time-code"
                           maxLength={6}
                           value={code}
                           onChange={(e) => {
                              setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                              setError('');
                           }}
                           placeholder="000000"
                           className="h-14 w-full rounded-md-input border border-md-neutral-600 bg-md-neutral-100 px-md-3 text-center text-[22px] font-semibold tracking-[0.3em] text-md-neutral-1200 outline-none focus:border-md-primary-900"
                        />
                     </div>
                  </div>
                  {error ? <p className="text-md-b3 text-md-red-400 text-center w-full">{error}</p> : null}
                  <div className="flex flex-col gap-md-3 w-full">
                     <button
                        type="button"
                        disabled={isSubmitting || code.length !== 6}
                        onClick={handleVerify}
                        className="w-full py-md-3 px-md-4 bg-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-neutral-100 disabled:opacity-50"
                     >
                        {isSubmitting ? 'Verifying...' : 'Confirm and enable'}
                     </button>
                     <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="w-full py-md-3 px-md-4 border border-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-primary-1200 disabled:opacity-50"
                     >
                        Cancel
                     </button>
                  </div>
               </>
            ) : null}
         </div>
      </div>
   );
}

// ─── Remove factor confirmation modal ───

function RemoveFactorModal({
   isOpen,
   factorLabel,
   onClose,
   onConfirm
}: {
   isOpen: boolean;
   factorLabel: string;
   onClose: () => void;
   onConfirm: () => Promise<void>;
}) {
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [error, setError] = useState('');

   const handleClose = () => {
      if (isSubmitting) return;
      setError('');
      onClose();
   };

   const handleConfirm = async () => {
      setIsSubmitting(true);
      setError('');
      try {
         await onConfirm();
         onClose();
      } catch (removeError) {
         setError(removeError instanceof Error ? removeError.message : 'Failed to remove');
      } finally {
         setIsSubmitting(false);
      }
   };

   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#12071f]/50 px-5" onClick={handleClose}>
         <div
            className="bg-white rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-md-3 items-center"
            onClick={(e) => e.stopPropagation()}
         >
            <div className="flex flex-col gap-2 items-center text-center">
               <h2 className="text-md-h4 font-semibold text-md-heading">Remove {factorLabel}?</h2>
               <p className="text-md-b1 text-md-neutral-1200">
                  You won't be asked for this the next time you sign in. You can set it up again anytime.
               </p>
            </div>
            {error ? <p className="text-md-b3 text-md-red-400 text-center w-full">{error}</p> : null}
            <div className="flex flex-col gap-md-3 w-full">
               <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirm}
                  className="w-full py-md-3 px-md-4 bg-md-red-500 rounded-md-lg text-md-b1 font-semibold text-md-neutral-100 disabled:opacity-50"
               >
                  {isSubmitting ? 'Removing...' : `Remove ${factorLabel}`}
               </button>
               <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="w-full py-md-3 px-md-4 border border-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-primary-1200 disabled:opacity-50"
               >
                  Cancel
               </button>
            </div>
         </div>
      </div>
   );
}

// ─── Section ───

type PendingRemoval = { factorId: string; label: string } | null;

export default function TwoFactorSettings() {
   const { totpFactor, passkeyFactor, isLoading, enrollPasskey, removeFactor, refresh } = useMfa();
   const { showToast } = useToast();

   const [showTotpModal, setShowTotpModal] = useState(false);
   const [isEnrollingPasskey, setIsEnrollingPasskey] = useState(false);
   const [passkeyError, setPasskeyError] = useState('');
   const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval>(null);

   const handleEnrollPasskey = async () => {
      setPasskeyError('');
      setIsEnrollingPasskey(true);
      try {
         await enrollPasskey('Passkey');
         showToast(TOAST_TYPES.SUCCESS, 'Passkey enabled', "You'll be asked for it the next time you sign in.");
      } catch (enrollError) {
         setPasskeyError(enrollError instanceof Error ? enrollError.message : 'Failed to set up passkey');
      } finally {
         setIsEnrollingPasskey(false);
      }
   };

   const handleRemove = async () => {
      if (!pendingRemoval) return;
      await removeFactor(pendingRemoval.factorId);
      showToast(TOAST_TYPES.SUCCESS, `${pendingRemoval.label} removed`, 'It will no longer be asked for at sign-in.');
   };

   if (isLoading) return null;

   return (
      <>
         <SettingsGroup label="Two-factor authentication" description="Optional. Add an extra step when you sign in.">
            <div className="flex min-h-[68px] items-center gap-md-2 px-md-3 py-md-2">
               {/* The 3D icons ship with their own rounded-square backdrop, so they sit bare here
                   rather than inside the lavender bg-md-primary-100 tile other rows use. */}
               <img src="/icons/two-factor-3d.png" alt="" className="size-10 shrink-0 object-contain" aria-hidden="true" />
               <div className="min-w-0 flex-1">
                  <p className="text-md-b1 font-semibold text-md-heading">Authenticator app</p>
                  <p className="text-md-b2 font-medium text-md-neutral-1200">{totpFactor ? 'Enabled' : 'Not set up'}</p>
               </div>
               <button
                  type="button"
                  onClick={() => (totpFactor ? setPendingRemoval({ factorId: totpFactor.id, label: 'authenticator app' }) : setShowTotpModal(true))}
                  className="min-h-11 shrink-0 rounded-md-input px-md-1 text-md-b2 font-semibold text-md-primary-900 transition-colors duration-150 hover:bg-md-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900"
               >
                  {totpFactor ? 'Remove' : 'Enable'}
               </button>
            </div>

            <div className="flex min-h-[68px] items-center gap-md-2 px-md-3 py-md-2">
               <img src="/icons/passkey-3d.png" alt="" className="size-10 shrink-0 object-contain" aria-hidden="true" />
               <div className="min-w-0 flex-1">
                  <p className="text-md-b1 font-semibold text-md-heading">Passkey</p>
                  <p className="text-md-b2 font-medium text-md-neutral-1200">
                     {passkeyFactor ? 'Enabled' : isEnrollingPasskey ? 'Waiting for your device...' : 'Face ID, Touch ID, or a security key'}
                  </p>
               </div>
               <button
                  type="button"
                  disabled={isEnrollingPasskey}
                  onClick={() =>
                     passkeyFactor ? setPendingRemoval({ factorId: passkeyFactor.id, label: 'passkey' }) : void handleEnrollPasskey()
                  }
                  className="min-h-11 shrink-0 rounded-md-input px-md-1 text-md-b2 font-semibold text-md-primary-900 transition-colors duration-150 hover:bg-md-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 disabled:opacity-50"
               >
                  {passkeyFactor ? 'Remove' : isEnrollingPasskey ? '...' : 'Enable'}
               </button>
            </div>
            {passkeyError ? <p className="px-md-3 pb-md-2 text-md-b3 text-md-red-400">{passkeyError}</p> : null}
         </SettingsGroup>

         <EnrollTotpModal isOpen={showTotpModal} onClose={() => setShowTotpModal(false)} onEnrolled={() => void refresh()} />
         <RemoveFactorModal
            isOpen={pendingRemoval !== null}
            factorLabel={pendingRemoval?.label ?? ''}
            onClose={() => setPendingRemoval(null)}
            onConfirm={handleRemove}
         />
      </>
   );
}
