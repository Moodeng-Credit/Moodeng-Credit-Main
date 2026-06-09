import { useEffect, useRef, useState } from 'react';

import { Camera } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAccount, useDisconnect } from 'wagmi';

import LanguageSwitcher from '@/components/LanguageSwitcher';
import TelegramAuthButton from '@/components/TelegramAuthButton';
import { useThemeMode } from '@/components/ThemeModeProvider';
import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import UserAvatar from '@/components/UserAvatar';

import { useAuthProvider } from '@/hooks/useAuthProvider';

import { useLocalization } from '@/i18n';
import { uploadAvatarForCurrentUser } from '@/lib/supabase/avatarStorage';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { getBaseWalletLockStatus, getWalletProviderLabel } from '@/lib/walletProvider';
import { getWorldIdVerificationLabel } from '@/lib/worldIdVerificationLabel';
import { confirmEmailChange, fetchUser, updateUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import AvatarUploadModal from '@/views/account/AvatarUploadModal';
import EditBioInfoModal from '@/views/account/EditBioInfoModal';

const ICON_MASK: React.CSSProperties = {
   WebkitMaskSize: 'contain',
   maskSize: 'contain',
   WebkitMaskRepeat: 'no-repeat',
   maskRepeat: 'no-repeat',
   WebkitMaskPosition: 'center',
   maskPosition: 'center'
};

const NOTIFICATION_STORAGE_KEY = 'md_notification_prefs';

interface NotificationPrefs {
   accountActivity: boolean;
   transactionActivity: boolean;
   moodengBlogs: boolean;
}

function loadNotificationPrefs(): NotificationPrefs {
   try {
      const stored = window.localStorage?.getItem(NOTIFICATION_STORAGE_KEY);
      if (stored) {
         return JSON.parse(stored) as NotificationPrefs;
      }
   } catch {
      return { accountActivity: true, transactionActivity: true, moodengBlogs: false };
   }
   return { accountActivity: true, transactionActivity: true, moodengBlogs: false };
}

function isTelegramPlaceholderEmail(email?: string | null) {
   return /^telegram_\d+@moodeng\.(app|credit)$/i.test(email ?? '');
}

function EditableAvatar({ size = 64, onClick }: { size?: number; onClick?: () => void }) {
   return (
      <button
         type="button"
         onClick={onClick}
         className="group relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2"
         aria-label="Change profile photo"
      >
         {/* clickable=false: this button already handles the click; we don't want a nested button */}
         <UserAvatar
            size={size}
            clickable={false}
            className="border-2 border-md-primary-100 transition-colors group-hover:border-md-primary-900"
         />
         <div className="absolute inset-0 rounded-full bg-[#12071f]/0 transition-colors group-hover:bg-[#12071f]/15 group-active:bg-[#12071f]/15" />
         <div className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-md-primary-900 shadow-md-card transition-colors group-hover:bg-md-primary-1200">
            <Camera size={14} className="text-white" />
         </div>
      </button>
   );
}

// ─── Reusable field ───

function ReadOnlyField({
   label,
   value,
   actionLabel,
   onAction,
   disabled = false
}: {
   label: string;
   value: string;
   actionLabel?: string;
   onAction?: () => void;
   disabled?: boolean;
}) {
   return (
      <div className={`flex flex-col gap-md-1 w-full ${disabled ? 'opacity-50' : ''}`}>
         <p className={`text-md-b2 font-semibold ${disabled ? 'text-md-neutral-700' : 'text-md-heading'}`}>{label}</p>
         <div
            className={`flex items-center justify-between rounded-md-input border px-md-3 py-md-2 overflow-hidden ${
               disabled
                  ? 'bg-md-neutral-200 border-md-neutral-400'
                  : 'bg-md-neutral-100 border-md-neutral-600 shadow-md-card'
            }`}
         >
            <span className={`text-md-b1 truncate ${disabled ? 'text-md-neutral-700' : 'text-md-neutral-1200'}`}>{value}</span>
            {actionLabel && onAction ? (
               <button type="button" onClick={onAction} className="text-md-b1 text-md-primary-900 shrink-0 ml-2">
                  {actionLabel}
               </button>
            ) : null}
         </div>
      </div>
   );
}

// ─── Toggle ───

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
   return (
      <button
         type="button"
         role="switch"
         aria-checked={checked}
         onClick={() => onChange(!checked)}
         className={`relative w-[42px] h-6 rounded-md-pill border border-md-primary-100 shrink-0 transition-colors duration-200 ${
            checked ? 'bg-md-primary-900' : 'bg-md-neutral-300'
         }`}
      >
         <span
            className={`absolute top-[2px] w-[18px] h-[18px] rounded-full shadow-sm transition-all duration-200 ${
               checked ? 'bg-white left-[21px]' : 'bg-md-neutral-800 left-[2px]'
            }`}
         />
      </button>
   );
}

// ─── Password Input with show/hide ───

function PasswordInput({
   label,
   value,
   onChange,
   placeholder
}: {
   label: string;
   value: string;
   onChange: (v: string) => void;
   placeholder?: string;
}) {
   const [visible, setVisible] = useState(false);
   return (
      <div className="flex flex-col gap-md-1 w-full">
         <p className="text-md-b2 font-semibold text-md-heading">{label}</p>
         <div className="flex items-center bg-md-neutral-100 border border-md-neutral-600 rounded-md-input shadow-md-card px-md-3 py-md-2 overflow-hidden">
            <input
               type={visible ? 'text' : 'password'}
               value={value}
               onChange={(e) => onChange(e.target.value)}
               placeholder={placeholder}
               className="flex-1 bg-transparent text-md-b1 text-md-neutral-1200 outline-none min-w-0"
            />
            <button type="button" onClick={() => setVisible(!visible)} className="shrink-0 ml-2">
               <div
                  className="w-5 h-5 bg-md-neutral-1000"
                  style={{
                     ...ICON_MASK,
                     WebkitMaskImage: `url('/icons/${visible ? 'eye' : 'eye-off'}.svg')`,
                     maskImage: `url('/icons/${visible ? 'eye' : 'eye-off'}.svg')`
                  }}
               />
            </button>
         </div>
      </div>
   );
}

// ─── Change Password Modal ───

function ChangePasswordModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
   const dispatch = useDispatch<AppDispatch>();
   const userEmail = useSelector((state: RootState) => state.auth.user?.email);
   const [oldPassword, setOldPassword] = useState('');
   const [newPassword, setNewPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');
   const [error, setError] = useState('');
   const [isSubmitting, setIsSubmitting] = useState(false);

   const resetForm = () => {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
   };

   const handleClose = () => {
      resetForm();
      onClose();
   };

   const handleSubmit = async () => {
      setError('');
      if (!oldPassword || !newPassword || !confirmPassword) {
         setError('All fields are required');
         return;
      }
      if (newPassword !== confirmPassword) {
         setError('New password and confirm password do not match');
         return;
      }
      if (newPassword.length < 6) {
         setError('Password must be at least 6 characters');
         return;
      }

      if (!userEmail) {
         setError('Unable to verify current account');
         return;
      }

      setIsSubmitting(true);

      const supabase = getSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.signInWithPassword({
         email: userEmail,
         password: oldPassword
      });
      if (verifyError) {
         setIsSubmitting(false);
         setError('Current password is incorrect');
         return;
      }

      const result = await dispatch(updateUser({ password: newPassword }));
      setIsSubmitting(false);

      if (updateUser.fulfilled.match(result)) {
         handleClose();
      } else {
         setError(result.error?.message || 'Failed to update password');
      }
   };

   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#12071f]/50 px-5" onClick={handleClose}>
         <div
            className="bg-white rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-md-3 items-center"
            onClick={(e) => e.stopPropagation()}
         >
            <div className="flex flex-col gap-md-5 items-center w-full">
               <div className="flex flex-col gap-2 items-center text-center">
                  <h2 className="text-md-h4 font-semibold text-md-heading">Change Password</h2>
                  <p className="text-md-b1 text-md-neutral-1200">Enter your current password and choose a new one.</p>
               </div>
               <div className="flex flex-col gap-md-5 w-full">
                  <PasswordInput label="Enter your old password" value={oldPassword} onChange={setOldPassword} placeholder="******" />
                  <PasswordInput label="Enter your new password" value={newPassword} onChange={setNewPassword} placeholder="******" />
                  <PasswordInput
                     label="Confirm your new password"
                     value={confirmPassword}
                     onChange={setConfirmPassword}
                     placeholder="******"
                  />
               </div>
            </div>
            {error ? <p className="text-md-b3 text-md-red-400 text-center w-full">{error}</p> : null}
            <button
               type="button"
               disabled={isSubmitting}
               onClick={handleSubmit}
               className="w-full py-md-3 px-md-4 bg-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-neutral-100 flex items-center justify-center gap-2 disabled:opacity-50"
            >
               {isSubmitting ? 'Updating...' : 'Update password'}
               {!isSubmitting ? (
                  <div
                     className="w-6 h-6 bg-md-neutral-100"
                     style={{
                        ...ICON_MASK,
                        WebkitMaskImage: "url('/icons/chevron-right.svg')",
                        maskImage: "url('/icons/chevron-right.svg')"
                     }}
                  />
               ) : null}
            </button>
            <button
               type="button"
               onClick={handleClose}
               className="w-full py-md-3 px-md-4 border border-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-primary-1200"
            >
               Cancel
            </button>
         </div>
      </div>
   );
}

// ─── Change Email Modal ───

function ChangeEmailModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
   const dispatch = useDispatch<AppDispatch>();
   const { showToast } = useToast();

   const [step, setStep] = useState<'enterEmail' | 'enterCode'>('enterEmail');
   const [newEmail, setNewEmail] = useState('');
   const [confirmEmail, setConfirmEmail] = useState('');
   const [code, setCode] = useState('');
   const [error, setError] = useState('');
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [isResending, setIsResending] = useState(false);

   const resetForm = () => {
      setStep('enterEmail');
      setNewEmail('');
      setConfirmEmail('');
      setCode('');
      setError('');
   };

   const handleClose = () => {
      resetForm();
      onClose();
   };

   const sendChangeRequest = async (email: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error: changeError } = await supabase.auth.updateUser({ email });

      if (changeError) {
         throw changeError;
      }
   };

   const handleSendCode = async () => {
      setError('');
      if (!newEmail || !confirmEmail) {
         setError('All fields are required');
         return;
      }
      if (newEmail !== confirmEmail) {
         setError('Emails do not match');
         return;
      }

      setIsSubmitting(true);
      try {
         await sendChangeRequest(newEmail);
         setCode('');
         setStep('enterCode');
      } catch (sendError) {
         setError(sendError instanceof Error ? sendError.message : 'Failed to send verification code');
      } finally {
         setIsSubmitting(false);
      }
   };

   const handleResendCode = async () => {
      if (isResending || isSubmitting) return;

      setError('');
      setIsResending(true);
      try {
         await sendChangeRequest(newEmail);
         showToast(TOAST_TYPES.SUCCESS, 'Code resent', `We sent a new verification code to ${newEmail}.`);
      } catch (resendError) {
         setError(resendError instanceof Error ? resendError.message : 'Failed to resend verification code');
      } finally {
         setIsResending(false);
      }
   };

   const handleVerifyCode = async () => {
      setError('');
      if (!code.trim()) {
         setError('Enter the verification code we sent to your new email');
         return;
      }

      setIsSubmitting(true);
      const result = await dispatch(confirmEmailChange({ email: newEmail, token: code.trim() }));
      setIsSubmitting(false);

      if (confirmEmailChange.fulfilled.match(result)) {
         showToast(TOAST_TYPES.SUCCESS, 'Email updated', 'Your email address has been changed.');
         handleClose();
      } else {
         setError(result.error?.message || 'Invalid or expired code. Please try again.');
      }
   };

   const handleBack = () => {
      setError('');
      setCode('');
      setStep('enterEmail');
   };

   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#12071f]/50 px-5" onClick={handleClose}>
         <div
            className="bg-white rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-[17px] items-center"
            onClick={(e) => e.stopPropagation()}
         >
            {step === 'enterEmail' ? (
               <>
                  <div className="flex flex-col gap-md-5 items-center w-full">
                     <div className="flex flex-col gap-2 items-center text-center">
                        <h2 className="text-md-h4 font-semibold text-md-heading">Change Email Address</h2>
                        <p className="text-md-b1 text-md-neutral-1200">
                           We'll send a verification code to your new email address to confirm the change.
                        </p>
                     </div>
                     <div className="flex flex-col gap-md-5 w-full">
                        <div className="flex flex-col gap-md-1 w-full">
                           <p className="text-md-b2 font-semibold text-md-heading">New Email</p>
                           <div className="flex items-center bg-md-neutral-100 border border-md-neutral-600 rounded-md-input shadow-md-card px-md-3 py-md-2 overflow-hidden">
                              <input
                                 type="email"
                                 value={newEmail}
                                 onChange={(e) => setNewEmail(e.target.value)}
                                 className="flex-1 bg-transparent text-md-b1 text-md-neutral-1200 outline-none min-w-0"
                              />
                           </div>
                        </div>
                        <div className="flex flex-col gap-md-1 w-full">
                           <p className="text-md-b2 font-semibold text-md-heading">Confirm Email</p>
                           <div className="flex items-center bg-md-neutral-100 border border-md-neutral-600 rounded-md-input shadow-md-card px-md-3 py-md-2 overflow-hidden">
                              <input
                                 type="email"
                                 value={confirmEmail}
                                 onChange={(e) => setConfirmEmail(e.target.value)}
                                 className="flex-1 bg-transparent text-md-b1 text-md-neutral-1200 outline-none min-w-0"
                              />
                           </div>
                        </div>
                     </div>
                  </div>
                  {error ? <p className="text-md-b3 text-md-red-400 text-center w-full">{error}</p> : null}
                  <div className="flex flex-col gap-[17px] w-full">
                     <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleSendCode}
                        className="w-full py-md-3 px-md-4 bg-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-neutral-100 flex items-center justify-center gap-2 disabled:opacity-50"
                     >
                        {isSubmitting ? 'Sending code...' : 'Send verification code'}
                        {!isSubmitting ? (
                           <div
                              className="w-6 h-6 bg-md-neutral-100"
                              style={{
                                 ...ICON_MASK,
                                 WebkitMaskImage: "url('/icons/chevron-right.svg')",
                                 maskImage: "url('/icons/chevron-right.svg')"
                              }}
                           />
                        ) : null}
                     </button>
                     <button
                        type="button"
                        onClick={handleClose}
                        className="w-full py-md-3 px-md-4 border border-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-primary-1200"
                     >
                        Cancel
                     </button>
                  </div>
               </>
            ) : (
               <>
                  <div className="flex flex-col gap-md-5 items-center w-full">
                     <div className="flex flex-col gap-2 items-center text-center">
                        <h2 className="text-md-h4 font-semibold text-md-heading">Enter Verification Code</h2>
                        <p className="text-md-b1 text-md-neutral-1200">
                           We sent a 6-digit code to <span className="font-semibold">{newEmail}</span>. Enter it below to confirm the
                           change.
                        </p>
                     </div>
                     <div className="flex flex-col gap-md-1 w-full">
                        <p className="text-md-b2 font-semibold text-md-heading">Verification Code</p>
                        <div className="flex items-center bg-md-neutral-100 border border-md-neutral-600 rounded-md-input shadow-md-card px-md-3 py-md-2 overflow-hidden">
                           <input
                              type="text"
                              inputMode="numeric"
                              maxLength={8}
                              value={code}
                              onChange={(e) => setCode(e.target.value)}
                              placeholder="123456"
                              className="flex-1 bg-transparent text-md-b1 text-md-neutral-1200 outline-none min-w-0 tracking-[0.3em]"
                           />
                        </div>
                     </div>
                     <button type="button" onClick={handleResendCode} disabled={isResending || isSubmitting} className="text-md-b2 font-semibold text-md-primary-1200 disabled:opacity-50">
                        {isResending ? 'Resending...' : "Didn't get a code? Resend"}
                     </button>
                  </div>
                  {error ? <p className="text-md-b3 text-md-red-400 text-center w-full">{error}</p> : null}
                  <div className="flex flex-col gap-[17px] w-full">
                     <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleVerifyCode}
                        className="w-full py-md-3 px-md-4 bg-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-neutral-100 flex items-center justify-center gap-2 disabled:opacity-50"
                     >
                        {isSubmitting ? 'Verifying...' : 'Confirm email change'}
                        {!isSubmitting ? (
                           <div
                              className="w-6 h-6 bg-md-neutral-100"
                              style={{
                                 ...ICON_MASK,
                                 WebkitMaskImage: "url('/icons/chevron-right.svg')",
                                 maskImage: "url('/icons/chevron-right.svg')"
                              }}
                           />
                        ) : null}
                     </button>
                     <button
                        type="button"
                        onClick={handleBack}
                        disabled={isSubmitting}
                        className="w-full py-md-3 px-md-4 border border-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-primary-1200 disabled:opacity-50"
                     >
                        Back
                     </button>
                  </div>
               </>
            )}
         </div>
      </div>
   );
}

function ChangeDisplayNameModal({
   isOpen,
   onClose,
   currentName
}: {
   isOpen: boolean;
   onClose: () => void;
   currentName: string;
}) {
   const dispatch = useDispatch<AppDispatch>();
   const { showToast } = useToast();
   const [name, setName] = useState(currentName);
   const [error, setError] = useState('');
   const [isSubmitting, setIsSubmitting] = useState(false);

   useEffect(() => {
      if (isOpen) {
         setName(currentName);
         setError('');
      }
   }, [isOpen, currentName]);

   const handleClose = () => {
      if (isSubmitting) return;
      setError('');
      onClose();
   };

   const handleSave = async () => {
      const trimmed = name.trim();
      if (!trimmed) {
         setError('Display name is required');
         return;
      }
      if (trimmed === currentName) {
         handleClose();
         return;
      }

      setError('');
      setIsSubmitting(true);
      const result = await dispatch(updateUser({ displayName: trimmed }));
      setIsSubmitting(false);

      if (updateUser.fulfilled.match(result)) {
         showToast(TOAST_TYPES.SUCCESS, 'Display name updated', 'Your display name has been changed.');
         onClose();
      } else {
         setError(result.error?.message || 'Failed to update display name');
      }
   };

   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#12071f]/50 px-5" onClick={handleClose}>
         <div
            className="bg-white rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-[17px] items-center"
            onClick={(e) => e.stopPropagation()}
         >
            <div className="flex flex-col gap-md-5 items-center w-full">
               <div className="flex flex-col gap-2 items-center text-center">
                  <h2 className="text-md-h4 font-semibold text-md-heading">Change Display Name</h2>
                  <p className="text-md-b1 text-md-neutral-1200">
                     This is the name other users will see on your profile and loan requests.
                  </p>
               </div>
               <div className="flex flex-col gap-md-1 w-full">
                  <p className="text-md-b2 font-semibold text-md-heading">Display Name</p>
                  <div className="flex items-center bg-md-neutral-100 border border-md-neutral-600 rounded-md-input shadow-md-card px-md-3 py-md-2 overflow-hidden">
                     <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoFocus
                        maxLength={60}
                        className="flex-1 bg-transparent text-md-b1 text-md-neutral-1200 outline-none min-w-0"
                     />
                  </div>
               </div>
            </div>
            {error ? <p className="text-md-b3 text-md-red-400 text-center w-full">{error}</p> : null}
            <div className="flex flex-col gap-[17px] w-full">
               <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSave}
                  className="w-full py-md-3 px-md-4 bg-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-neutral-100 flex items-center justify-center gap-2 disabled:opacity-50"
               >
                  {isSubmitting ? 'Saving...' : 'Save changes'}
                  {!isSubmitting ? (
                     <div
                        className="w-6 h-6 bg-md-neutral-100"
                        style={{
                           ...ICON_MASK,
                           WebkitMaskImage: "url('/icons/chevron-right.svg')",
                           maskImage: "url('/icons/chevron-right.svg')"
                        }}
                     />
                  ) : null}
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

function TelegramAlertsModal({
   isOpen,
   onClose,
   onConnected,
   onRefresh,
   onCreateConnectLink
}: {
   isOpen: boolean;
   onClose: () => void;
   onConnected: (authData: Record<string, string>) => Promise<void>;
   onRefresh: () => Promise<boolean>;
   onCreateConnectLink: () => Promise<string>;
}) {
   const { showToast } = useToast();
   const [error, setError] = useState('');
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [hasOpenedBot, setHasOpenedBot] = useState(false);
   const isSubmittingRef = useRef(false);

   const handleClose = () => {
      if (isSubmitting) return;
      setError('');
      setHasOpenedBot(false);
      onClose();
   };

   const handleTelegramAuth = async (authData: Record<string, string>) => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setError('');
      setIsSubmitting(true);
      try {
         await onConnected(authData);
         isSubmittingRef.current = false;
         setIsSubmitting(false);
         setError('');
         onClose();
      } catch (err) {
         const message = err instanceof Error ? err.message : 'Failed to connect Telegram alerts';
         isSubmittingRef.current = false;
         setIsSubmitting(false);
         setError(message);
         showToast(TOAST_TYPES.ERROR, 'Telegram alerts not connected', message, 'Contact support', 'contact_support');
      }
   };

   const handleOpenTelegramBot = async () => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setError('');
      setIsSubmitting(true);
      try {
         const url = await onCreateConnectLink();
         window.open(url, '_blank', 'noopener,noreferrer');
         setHasOpenedBot(true);
      } catch (err) {
         const message = err instanceof Error ? err.message : 'Failed to create Telegram connection link';
         setError(message);
         showToast(TOAST_TYPES.ERROR, 'Telegram alerts not connected', message, 'Contact support', 'contact_support');
      } finally {
         isSubmittingRef.current = false;
         setIsSubmitting(false);
      }
   };

   const handleRefreshConnection = async () => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setError('');
      setIsSubmitting(true);
      try {
         const isConnected = await onRefresh();
         isSubmittingRef.current = false;
         setIsSubmitting(false);
         if (isConnected) {
            setError('');
            onClose();
            return;
         }

         setError('Open Telegram, tap Start in the bot, then check again.');
      } catch (err) {
         const message = err instanceof Error ? err.message : 'Failed to refresh Telegram alerts';
         isSubmittingRef.current = false;
         setIsSubmitting(false);
         setError(message);
         showToast(TOAST_TYPES.ERROR, 'Telegram alerts not connected', message, 'Contact support', 'contact_support');
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
               <h2 className="text-md-h4 font-semibold text-md-heading">Telegram Alerts</h2>
               <p className="text-md-b1 text-md-neutral-1200">Connect private loan alerts to your Telegram account.</p>
            </div>
            <div className="flex w-full flex-col gap-2">
               <button
                  type="button"
                  onClick={handleOpenTelegramBot}
                  disabled={isSubmitting}
                  className="w-full rounded-md-lg bg-md-primary-1200 px-md-4 py-md-3 text-center text-md-b1 font-semibold text-md-neutral-100 disabled:opacity-50"
               >
                  Open Telegram Bot
               </button>
               <button
                  type="button"
                  onClick={handleRefreshConnection}
                  disabled={isSubmitting || !hasOpenedBot}
                  className="w-full rounded-md-lg border border-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-primary-1200 disabled:opacity-50"
               >
                  Check Connection
               </button>
            </div>
            <div className="flex w-full items-center gap-3 text-md-b3 font-semibold text-md-neutral-700">
               <div className="h-px flex-1 bg-md-neutral-600" />
               <span>or</span>
               <div className="h-px flex-1 bg-md-neutral-600" />
            </div>
            <div className={`w-full ${isSubmitting ? 'pointer-events-none opacity-60' : ''}`}>
               <TelegramAuthButton onAuth={handleTelegramAuth} buttonSize="large" requestWriteAccess />
            </div>
            {error ? <p className="text-md-b3 text-md-red-400 text-center w-full">{error}</p> : null}
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
   );
}

// ─── Main Component ───

export default function AccountSettings() {
   const navigate = useNavigate();
   const [searchParams] = useSearchParams();
   const { t } = useLocalization();
   const editTarget = searchParams.get('edit');
   const handledEditTargetRef = useRef<string | null>(null);
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const { connector, chain } = useAccount();
   const { disconnect } = useDisconnect();
   const { isEmailPasswordUser } = useAuthProvider();
   const { isDarkMode, setMode } = useThemeMode();

   const currentDisplayName = user?.displayName ?? user?.username ?? '';
   const [showNameModal, setShowNameModal] = useState(false);
   const [showPasswordModal, setShowPasswordModal] = useState(false);
   const [showEmailModal, setShowEmailModal] = useState(false);
   const [showTelegramAlertsModal, setShowTelegramAlertsModal] = useState(false);
   const [showBioInfoModal, setShowBioInfoModal] = useState(false);
   const [showAvatarModal, setShowAvatarModal] = useState(false);
   const [isSavingAvatar, setIsSavingAvatar] = useState(false);
   const [walletCopied, setWalletCopied] = useState(false);
   const [showWalletActions, setShowWalletActions] = useState(false);
   const [isEditingWallet, setIsEditingWallet] = useState(false);
   const [isChangeWalletPending, setIsChangeWalletPending] = useState(false);
   const [isDisconnectWalletPending, setIsDisconnectWalletPending] = useState(false);
   const [isSavingWallet, setIsSavingWallet] = useState(false);
   const [walletError, setWalletError] = useState('');
   const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(loadNotificationPrefs);

   const hasWallet = Boolean(user?.walletAddress);
   const walletSetupLabel = user?.userRole === 'lender' ? 'Connect' : 'Connect Base Account';
   const isBorrower = user?.userRole === 'borrower';
   const connectedWalletName = connector?.name;
   const baseWalletLock = getBaseWalletLockStatus(user);
   const borrowerHasConfirmedBaseWallet = isBorrower && baseWalletLock.isConfirmedBase;
   const borrowerHasNonBaseWallet =
      isBorrower &&
      hasWallet &&
      Boolean(baseWalletLock.provider) &&
      baseWalletLock.provider !== 'unknown' &&
      !baseWalletLock.isConfirmedBase;
   const borrowerNeedsBaseWallet = isBorrower && !baseWalletLock.isConfirmedBase;
   const hasTelegramPlaceholderEmail = isTelegramPlaceholderEmail(user?.email);
   const emailFieldValue = hasTelegramPlaceholderEmail ? 'No email added' : user?.email || 'No email added';
   const emailActionLabel = hasTelegramPlaceholderEmail ? 'Add' : isEmailPasswordUser ? 'Change' : undefined;
   const canEditEmail = isEmailPasswordUser || hasTelegramPlaceholderEmail;
   const emailHelpCopy = hasTelegramPlaceholderEmail
      ? 'Telegram sign-in does not provide a real email. Add one for account recovery and notifications.'
      : 'Having an up-to-date email address attached to your account is a great step towards improving account security.';
   const telegramAlertsValue = user?.chatId
      ? user?.telegramUsername
         ? `@${user.telegramUsername}`
         : 'Connected'
      : user?.telegramUsername || 'Not Connected';

   useEffect(() => {
      try {
         window.localStorage?.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notifPrefs));
      } catch {
         // Some embedded previews disable localStorage; notification toggles can still render.
      }
   }, [notifPrefs]);

   useEffect(() => {
      if (!editTarget || handledEditTargetRef.current === editTarget) return;

      handledEditTargetRef.current = editTarget;

      if (editTarget === 'name') {
         setShowNameModal(true);
         window.requestAnimationFrame(() => {
            document.getElementById('display-name-section')?.scrollIntoView({ block: 'center' });
         });
      }

      if (editTarget === 'avatar') {
         setShowAvatarModal(true);
         window.requestAnimationFrame(() => {
            document.getElementById('avatar-section')?.scrollIntoView({ block: 'center' });
         });
      }
   }, [currentDisplayName, editTarget]);

   useEffect(() => {
      setIsEditingWallet(false);
      setIsChangeWalletPending(false);
      setIsDisconnectWalletPending(false);
      setWalletError('');
   }, [user?.walletAddress]);

   const handleCopyWallet = async () => {
      if (!user?.walletAddress) return;
      await navigator.clipboard.writeText(user.walletAddress);
      setWalletCopied(true);
      setTimeout(() => setWalletCopied(false), 2000);
   };

   const handleRevertWalletChanges = () => {
      setIsEditingWallet(false);
      setIsChangeWalletPending(false);
      setIsDisconnectWalletPending(false);
      setWalletError('');
   };

   const handleSaveWalletChanges = async () => {
      if (!isDisconnectWalletPending) {
         handleRevertWalletChanges();
         return;
      }

      setIsSavingWallet(true);
      setWalletError('');
      try {
         const result = await dispatch(
            updateUser({
               walletAddress: null,
               walletChainId: null,
               walletConnectorName: null,
               walletProvider: null
            })
         );

         if (!updateUser.fulfilled.match(result)) {
            throw new Error(result.error?.message || 'Failed to update wallet.');
         }

         disconnect();
         handleRevertWalletChanges();
      } catch (err) {
         setWalletError(err instanceof Error ? err.message : 'Failed to update wallet.');
      } finally {
         setIsSavingWallet(false);
      }
   };

   const handleSaveAvatar = async (file: File, avatarBackground: string) => {
      setIsSavingAvatar(true);
      try {
         const avatarUrl = await uploadAvatarForCurrentUser(file);
         const result = await dispatch(updateUser({ avatarUrl, avatarBackground }));

         if (updateUser.fulfilled.match(result)) {
            setShowAvatarModal(false);
            return;
         }

         throw new Error(result.error?.message || 'Failed to update profile photo');
      } finally {
         setIsSavingAvatar(false);
      }
   };

   const handleConnectTelegramAlerts = async (authData: Record<string, string>) => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.functions.invoke('connect-telegram-notifications', {
         body: { authData }
      });

      if (error) {
         const response = (error as { context?: Response }).context;
         if (response) {
            const body = (await response
               .clone()
               .json()
               .catch(() => null)) as { error?: string } | null;
            if (body?.error) throw new Error(body.error);
         }
         throw error;
      }
      if (data?.error) throw new Error(data.error);

      const result = await dispatch(fetchUser());
      if (!fetchUser.fulfilled.match(result)) {
         throw new Error(result.error?.message || 'Failed to refresh Telegram alerts');
      }
   };

   const handleRefreshTelegramAlerts = async () => {
      const result = await dispatch(fetchUser());
      if (!fetchUser.fulfilled.match(result)) {
         throw new Error(result.error?.message || 'Failed to refresh Telegram alerts');
      }

      return Boolean(result.payload?.chatId);
   };

   const handleCreateTelegramConnectLink = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.functions.invoke('create-telegram-connect-link', {
         body: {}
      });

      if (error) {
         const response = (error as { context?: Response }).context;
         if (response) {
            const body = (await response
               .clone()
               .json()
               .catch(() => null)) as { error?: string } | null;
            if (body?.error) throw new Error(body.error);
         }
         throw error;
      }

      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error('Telegram connection link was not created');

      return data.url as string;
   };

   const truncateAddress = (addr: string) => {
      if (addr.length <= 12) return addr;
      return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
   };
   const walletLabel = getWalletProviderLabel({
      connectorName: user?.walletConnectorName || connectedWalletName,
      provider: user?.walletProvider,
      assumeBaseAccount: isBorrower && hasWallet && !borrowerHasNonBaseWallet
   });

   const toggleNotif = (key: keyof NotificationPrefs) => {
      setNotifPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
   };

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-4 px-md-5 py-md-3">
               <button type="button" onClick={() => navigate('/account')} className="shrink-0">
                  <div
                     className="w-6 h-6 bg-md-heading"
                     style={{
                        ...ICON_MASK,
                        WebkitMaskImage: "url('/icons/arrow-left.svg')",
                        maskImage: "url('/icons/arrow-left.svg')"
                     }}
                  />
               </button>
               <h1 className="text-md-h3 font-semibold text-md-heading">Account Settings</h1>
            </div>

            {/* Avatar + Name */}
            <div className="flex items-center gap-md-5 px-md-5 py-md-3">
               <div id="avatar-section" className="flex flex-col gap-md-1 items-center shrink-0">
                  <EditableAvatar onClick={() => setShowAvatarModal(true)} />
                  <button type="button" onClick={() => setShowAvatarModal(true)} className="text-md-b1 text-md-primary-900">
                     Change
                  </button>
               </div>
               <div id="display-name-section" className="flex flex-col gap-md-1 flex-1 min-w-0">
                  <p className="text-md-b2 font-semibold text-md-heading">Display Name</p>
                  <div className="flex items-center justify-between bg-md-neutral-100 border border-md-neutral-600 rounded-md-input shadow-md-card px-md-3 py-md-2 overflow-hidden">
                     <span className="text-md-b1 text-md-neutral-1200 truncate">{currentDisplayName}</span>
                     <button
                        type="button"
                        onClick={() => setShowNameModal(true)}
                        className="text-md-b1 text-md-primary-900 shrink-0 ml-2"
                     >
                        Change
                     </button>
                  </div>
               </div>
            </div>

            {/* Sections */}
            <div className="flex flex-col gap-5 px-md-4">
               {/* Basic Information */}
               <div className="flex flex-col gap-3">
                  <h2 className="text-md-h5 font-semibold text-md-heading">Basic Information</h2>
                  <p className="text-md-b2 font-medium text-md-neutral-700">{emailHelpCopy}</p>
                  <ReadOnlyField
                     label="Email Address"
                     value={emailFieldValue}
                     actionLabel={emailActionLabel}
                     onAction={canEditEmail ? () => setShowEmailModal(true) : undefined}
                  />
                  <ReadOnlyField
                     label="Telegram Alerts"
                     value={telegramAlertsValue}
                     actionLabel={user?.chatId ? undefined : 'Connect'}
                     onAction={user?.chatId ? undefined : () => setShowTelegramAlertsModal(true)}
                  />
                  <ReadOnlyField label="WhatsApp" value="Coming soon" disabled />
                  <ReadOnlyField label="LINE" value="Coming soon" disabled />
                  {isBorrower ? (
                     <ReadOnlyField
                        label="Bio Info"
                        value="Work, income, and what you need help with"
                        actionLabel="Change"
                        onAction={() => setShowBioInfoModal(true)}
                     />
                  ) : null}
               </div>

               {/* Language */}
               <div className="flex flex-col gap-3">
                  <h2 className="text-md-h5 font-semibold text-md-heading">{t('language.label')}</h2>
                  <p className="text-md-b2 font-medium text-md-neutral-700">{t('language.settingsDescription')}</p>
                  <div className="rounded-md-input border border-md-neutral-600 bg-md-neutral-100 p-3 shadow-md-card">
                     <LanguageSwitcher tone="light" variant="full" />
                  </div>
               </div>

               {/* Security */}
               <div className="flex flex-col gap-3">
                  <h2 className="text-md-h5 font-semibold text-md-heading">Security</h2>
                  <p className="text-md-b2 font-medium text-md-neutral-700">
                     This information will be shown publicly so be careful what information you provide
                  </p>

                  {isEmailPasswordUser ? (
                     <ReadOnlyField label="Password" value="******" actionLabel="Change" onAction={() => setShowPasswordModal(true)} />
                  ) : null}

                  {/* World ID */}
                  <div className="flex flex-col gap-md-1 w-full">
                     <p className="text-md-b2 font-semibold text-md-heading">World ID</p>
                     <div className="flex items-center gap-2 bg-md-neutral-100 border border-md-neutral-600 rounded-md-input shadow-md-card px-md-3 py-md-2 overflow-hidden">
                        {user?.isWorldId === 'ACTIVE' ? (
                           <>
                              <img src="/icons/check-fill.svg" alt="" className="w-4 h-4 shrink-0" />
                              <span className="text-md-b1 font-medium text-md-green-900">
                                 {getWorldIdVerificationLabel({
                                    isWorldId: user?.isWorldId,
                                    userRole: user?.userRole
                                 })}
                              </span>
                           </>
                        ) : (
                           <span className="text-md-b1 text-md-neutral-1200">Not Verified</span>
                        )}
                     </div>
                  </div>

                  {/* Wallet */}
                  <div className="flex flex-col gap-md-1 w-full relative">
                     <p className="text-md-b2 font-semibold text-md-heading">Wallet</p>
                     <div className="flex items-center justify-between bg-md-neutral-100 border border-md-neutral-600 rounded-md-input shadow-md-card px-md-3 py-md-2 overflow-hidden">
                        {hasWallet ? (
                           <>
                              <button
                                 type="button"
                                 onClick={() => {
                                    setShowWalletActions((current) => !current);
                                 }}
                                 className="flex min-w-0 flex-1 items-center justify-between gap-md-2 text-left"
                                 aria-expanded={showWalletActions}
                              >
                                 <span className="flex min-w-0 shrink-0 items-center gap-2 text-md-b1 text-md-neutral-1200">
                                    <span
                                       className="block size-4 bg-md-primary-900"
                                       style={{
                                          ...ICON_MASK,
                                          WebkitMaskImage: "url('/icons/locked.svg')",
                                          maskImage: "url('/icons/locked.svg')"
                                       }}
                                    />
                                    <span className="truncate">{walletLabel}</span>
                                 </span>
                                 <span className="mx-md-2 h-6 w-px shrink-0 bg-md-neutral-600" aria-hidden="true" />
                                 <span className="min-w-0 flex-1 truncate text-right text-md-b2 font-medium text-md-neutral-900">
                                    {truncateAddress(user?.walletAddress || '')}
                                 </span>
                              </button>
                              <button
                                 type="button"
                                 onClick={() => {
                                    setShowWalletActions(true);
                                    setIsEditingWallet(true);
                                    setIsChangeWalletPending(true);
                                    setIsDisconnectWalletPending(false);
                                 }}
                                 className="ml-2 shrink-0 text-md-b2 font-semibold text-md-primary-900"
                              >
                                 Change
                              </button>
                              <button type="button" onClick={handleCopyWallet} className="shrink-0 ml-2" aria-label="Copy wallet address">
                                 {walletCopied ? (
                                    <span className="text-md-b2 font-semibold text-md-primary-900">Copied</span>
                                 ) : (
                                    <div
                                       className="w-5 h-5 bg-md-primary-900"
                                       style={{
                                          ...ICON_MASK,
                                          WebkitMaskImage: "url('/icons/copy.svg')",
                                          maskImage: "url('/icons/copy.svg')"
                                       }}
                                    />
                                 )}
                              </button>
                           </>
                        ) : (
                           <>
                              <span className="text-md-b1 text-md-neutral-1200">Not Connected</span>
                              <button
                                 type="button"
                                 onClick={() => navigate('/onboarding/wallet')}
                                 className="text-md-b1 text-md-primary-900 shrink-0 ml-2"
                              >
                                 {walletSetupLabel}
                              </button>
                           </>
                        )}
                     </div>
                  </div>

                  {borrowerNeedsBaseWallet && hasWallet && showWalletActions ? (
                     <div className="flex flex-col gap-md-2 rounded-md-lg border border-md-primary-900 bg-md-primary-900/10 p-md-3">
                        {isChangeWalletPending ? (
                           <div className="flex flex-col gap-md-2 rounded-md-md border border-md-primary-100 bg-md-neutral-100 p-md-2">
                              <p className="text-md-b2 font-semibold text-md-heading">Change Base Account?</p>
                              <p className="text-md-b3 font-medium leading-5 text-md-neutral-1200">
                                 Future funded loans and repayments will use the new Base Account. Your existing repayment history stays
                                 tied to this account.
                              </p>
                              <div className="grid grid-cols-2 gap-md-2">
                                 <button
                                    type="button"
                                    onClick={handleRevertWalletChanges}
                                    className="rounded-md-lg border border-md-primary-900 bg-md-neutral-100 px-md-3 py-md-2 text-md-b2 font-semibold text-md-primary-900"
                                 >
                                    Cancel
                                 </button>
                                 <button
                                    type="button"
                                    onClick={() => navigate('/onboarding/wallet', { state: { returnTo: 'account-settings' } })}
                                    className="rounded-md-lg bg-md-primary-1200 px-md-3 py-md-2 text-md-b2 font-semibold text-md-neutral-100"
                                 >
                                    Continue to change
                                 </button>
                              </div>
                           </div>
                        ) : isDisconnectWalletPending ? (
                           <div className="flex flex-col gap-md-2 rounded-md-md border border-md-red-100 bg-md-red-100/60 p-md-2">
                              <p className="text-md-b2 font-semibold text-md-heading">Disconnect wallet?</p>
                              <p className="text-md-b3 font-medium leading-5 text-md-neutral-1200">
                                 Save changes to remove this wallet from your account. You can reconnect a Base Account after.
                              </p>
                              {walletError ? <p className="text-md-b3 font-medium text-md-red-500">{walletError}</p> : null}
                              <div className="grid grid-cols-2 gap-md-2">
                                 <button
                                    type="button"
                                    onClick={handleRevertWalletChanges}
                                    disabled={isSavingWallet}
                                    className="rounded-md-lg border border-md-primary-900 bg-md-neutral-100 px-md-3 py-md-2 text-md-b2 font-semibold text-md-primary-900 disabled:opacity-60"
                                 >
                                    Cancel
                                 </button>
                                 <button
                                    type="button"
                                    onClick={handleSaveWalletChanges}
                                    disabled={isSavingWallet}
                                    className="rounded-md-lg bg-md-primary-1200 px-md-3 py-md-2 text-md-b2 font-semibold text-md-neutral-100 disabled:opacity-60"
                                 >
                                    {isSavingWallet ? 'Saving...' : 'Disconnect'}
                                 </button>
                              </div>
                           </div>
                        ) : (
                           <>
                              <div className="flex items-start gap-md-2">
                                 <img src="/icons/base-account.svg" alt="" className="size-9 rounded-md-md shrink-0" />
                                 <div className="flex min-w-0 flex-1 flex-col gap-md-0">
                                    <p className="text-md-b1 font-semibold text-md-heading">Confirm your Base Account</p>
                                    <p className="text-md-b2 font-medium text-md-neutral-1200">
                                       {borrowerHasNonBaseWallet
                                          ? `Your account is using ${walletLabel}. Connect a Base Account so funded loans and repayments use the right wallet.`
                                          : 'Reconnect and confirm this is a Base Account before you borrow or repay.'}
                                    </p>
                                 </div>
                              </div>
                              <button
                                 type="button"
                                 onClick={() => navigate('/onboarding/wallet', { state: { returnTo: 'account-settings' } })}
                                 className="inline-flex w-full items-center justify-center rounded-md-lg bg-md-primary-1200 px-md-4 py-md-2 text-md-b1 font-semibold text-md-neutral-100 active:scale-[0.99]"
                              >
                                 Confirm Base Account
                              </button>
                              <button
                                 type="button"
                                 onClick={() => {
                                    setIsEditingWallet(true);
                                    setIsChangeWalletPending(false);
                                    setIsDisconnectWalletPending(true);
                                 }}
                                 className="self-start text-md-b2 font-semibold text-md-red-500"
                              >
                                 Disconnect wallet
                              </button>
                           </>
                        )}
                     </div>
                  ) : null}

                  {borrowerHasConfirmedBaseWallet && showWalletActions ? (
                     <div className="flex flex-col gap-md-3 rounded-md-lg border border-md-primary-100 bg-md-primary-900/5 p-md-3">
                        <div className="flex items-start gap-md-2">
                           <img src="/icons/base-account.svg" alt="" className="size-8 rounded-md-md shrink-0" />
                           <div className="min-w-0">
                              <p className="text-md-b2 font-semibold text-md-heading">Base Account locked</p>
                              <p className="text-md-b3 font-medium leading-5 text-md-neutral-1200">
                                 This wallet receives funded loans and is used for repayment history. Change it only if this is no longer
                                 your Base Account.
                              </p>
                           </div>
                        </div>

                        {isEditingWallet ? (
                           <div className="flex flex-col gap-md-2">
                              {isChangeWalletPending ? (
                                 <div className="flex flex-col gap-md-2 rounded-md-md border border-md-primary-100 bg-md-neutral-100 p-md-2">
                                    <p className="text-md-b2 font-semibold text-md-heading">Change Base Account?</p>
                                    <p className="text-md-b3 font-medium leading-5 text-md-neutral-1200">
                                       Future funded loans and repayments will use the new Base Account. Your existing repayment history
                                       stays tied to this account.
                                    </p>
                                    <div className="grid grid-cols-2 gap-md-2">
                                       <button
                                          type="button"
                                          onClick={handleRevertWalletChanges}
                                          className="rounded-md-lg border border-md-primary-900 bg-md-neutral-100 px-md-3 py-md-2 text-md-b2 font-semibold text-md-primary-900"
                                       >
                                          Cancel
                                       </button>
                                       <button
                                          type="button"
                                          onClick={() => navigate('/onboarding/wallet', { state: { returnTo: 'account-settings' } })}
                                          className="rounded-md-lg bg-md-primary-1200 px-md-3 py-md-2 text-md-b2 font-semibold text-md-neutral-100"
                                       >
                                          Continue to change
                                       </button>
                                    </div>
                                 </div>
                              ) : isDisconnectWalletPending ? (
                                 <div className="flex flex-col gap-md-2 rounded-md-md border border-md-red-100 bg-md-red-100/60 p-md-2">
                                    <p className="text-md-b2 font-semibold text-md-heading">Disconnect wallet?</p>
                                    <p className="text-md-b3 font-medium leading-5 text-md-neutral-1200">
                                       Save changes to remove this wallet from your account. You will need to connect a Base Account again
                                       before borrowing or repaying.
                                    </p>
                                    {walletError ? <p className="text-md-b3 font-medium text-md-red-500">{walletError}</p> : null}
                                    <div className="grid grid-cols-2 gap-md-2">
                                       <button
                                          type="button"
                                          onClick={handleRevertWalletChanges}
                                          disabled={isSavingWallet}
                                          className="rounded-md-lg border border-md-primary-900 bg-md-neutral-100 px-md-3 py-md-2 text-md-b2 font-semibold text-md-primary-900 disabled:opacity-60"
                                       >
                                          Cancel
                                       </button>
                                       <button
                                          type="button"
                                          onClick={handleSaveWalletChanges}
                                          disabled={isSavingWallet}
                                          className="rounded-md-lg bg-md-primary-1200 px-md-3 py-md-2 text-md-b2 font-semibold text-md-neutral-100 disabled:opacity-60"
                                       >
                                          {isSavingWallet ? 'Saving...' : 'Disconnect'}
                                       </button>
                                    </div>
                                 </div>
                              ) : (
                                 <div className="grid grid-cols-2 gap-md-2">
                                    <button
                                       type="button"
                                       onClick={() => {
                                          setIsChangeWalletPending(true);
                                          setIsDisconnectWalletPending(false);
                                       }}
                                       className="rounded-md-lg border border-md-primary-900 bg-md-neutral-100 px-md-3 py-md-2 text-md-b2 font-semibold text-md-primary-900 active:scale-[0.99]"
                                    >
                                       Change wallet
                                    </button>
                                    <button
                                       type="button"
                                       onClick={() => setIsDisconnectWalletPending(true)}
                                       className="rounded-md-lg border border-md-red-100 bg-md-red-100/60 px-md-3 py-md-2 text-md-b2 font-semibold text-md-red-500 active:scale-[0.99]"
                                    >
                                       Disconnect wallet
                                    </button>
                                 </div>
                              )}
                           </div>
                        ) : (
                           <button
                              type="button"
                              onClick={() => setIsEditingWallet(true)}
                              className="self-start text-md-b2 font-semibold text-md-primary-900"
                           >
                              Change wallet
                           </button>
                        )}
                     </div>
                  ) : null}

                  {/* Network */}
                  {hasWallet ? (
                     <div className="flex flex-col gap-md-1 w-full">
                        <p className="text-md-b2 font-semibold text-md-heading">Network</p>
                        <div className="flex items-center gap-md-1 bg-md-neutral-100 border border-md-neutral-600 rounded-md-input shadow-md-card px-md-3 py-md-2 overflow-hidden">
                           <span className="text-md-b1 text-md-neutral-1200">{chain?.name || 'Base'}</span>
                        </div>
                     </div>
                  ) : null}
               </div>

               {/* Appearance */}
               <div className="flex flex-col gap-3">
                  <h2 className="text-md-h5 font-semibold text-md-heading">Appearance</h2>
                  <p className="text-md-b2 font-medium text-md-neutral-700">Choose how Moodeng looks on this device.</p>

                  <div className="flex flex-col gap-2">
                     <div className="flex items-center justify-between">
                        <p className="text-md-b2 font-semibold text-md-heading">Dark Mode</p>
                        <Toggle checked={isDarkMode} onChange={(checked) => setMode(checked ? 'dark' : 'light')} />
                     </div>
                     <p className="text-md-b3 font-medium text-md-neutral-1400">Use darker app surfaces across the website.</p>
                  </div>
               </div>

               {/* Notifications */}
               <div className="flex flex-col gap-3">
                  <h2 className="text-md-h5 font-semibold text-md-heading">Notifications</h2>
                  <p className="text-md-b2 font-medium text-md-neutral-700">
                     {hasTelegramPlaceholderEmail
                        ? 'Add a real email address before turning on email notifications.'
                        : 'Get notified of activity going on with your account. Notifications will be sent to the email that you have provided.'}
                  </p>

                  <div className="flex flex-col gap-2">
                     {/* Account Activity */}
                     <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                           <p className="text-md-b2 font-semibold text-md-heading">Account Activity</p>
                           <Toggle checked={notifPrefs.accountActivity} onChange={() => toggleNotif('accountActivity')} />
                        </div>
                        <p className="text-md-b3 font-medium text-md-neutral-1400">
                           Get important notifications about you or activity you've missed
                        </p>
                     </div>

                     {/* Transaction Activity */}
                     <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                           <p className="text-md-b2 font-semibold text-md-heading">Transaction Activity</p>
                           <Toggle checked={notifPrefs.transactionActivity} onChange={() => toggleNotif('transactionActivity')} />
                        </div>
                        <p className="text-md-b3 font-medium text-md-neutral-1400">Get important notifications about your transactions</p>
                     </div>

                     {/* Moodeng Blogs */}
                     <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                           <p className="text-md-b2 font-semibold text-md-heading">Moodeng Blogs</p>
                           <Toggle checked={notifPrefs.moodengBlogs} onChange={() => toggleNotif('moodengBlogs')} />
                        </div>
                        <p className="text-md-b3 font-medium text-md-neutral-1400">Get updated with our latest news, updates and blogs</p>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         <AvatarUploadModal
            isOpen={showAvatarModal}
            isSaving={isSavingAvatar}
            currentAvatar={user?.avatarUrl}
            currentAvatarBackground={user?.avatarBackground}
            onClose={() => setShowAvatarModal(false)}
            onSave={handleSaveAvatar}
         />

         <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
         <ChangeEmailModal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} />
         <ChangeDisplayNameModal isOpen={showNameModal} onClose={() => setShowNameModal(false)} currentName={currentDisplayName} />
         <EditBioInfoModal isOpen={showBioInfoModal} onClose={() => setShowBioInfoModal(false)} user={user} />
         <TelegramAlertsModal
            isOpen={showTelegramAlertsModal}
            onClose={() => setShowTelegramAlertsModal(false)}
            onConnected={handleConnectTelegramAlerts}
            onRefresh={handleRefreshTelegramAlerts}
            onCreateConnectLink={handleCreateTelegramConnectLink}
         />
      </div>
   );
}
