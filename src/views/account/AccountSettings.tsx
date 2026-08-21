import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

import {
   AlertCircle,
   ArrowLeft,
   Camera,
   CheckCircle2,
   ChevronRight,
   Clock3,
   WalletCards
} from 'lucide-react';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

import LanguageSwitcher from '@/components/LanguageSwitcher';
import TelegramAuthButton from '@/components/TelegramAuthButton';
import { useThemeMode } from '@/components/ThemeModeProvider';
import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import UserAvatar from '@/components/UserAvatar';

import { useAuthProvider } from '@/hooks/useAuthProvider';

import { useLocalization } from '@/i18n';
import { isLikelyPhilippines } from '@/lib/isLikelyPhilippines';
import { getVerificationUiState, VERIFICATION_STATE_LABEL, type VerificationUiState } from '@/lib/verificationUiState';
import { uploadAvatarForCurrentUser } from '@/lib/supabase/avatarStorage';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
   beginWalletChangeIntent,
   cancelWalletChangeIntent,
   completeWalletChangeIntent,
   WALLET_CHANGE_FAILED_EVENT
} from '@/lib/walletChangeIntent';
import { getBaseAccountConnector, getBaseWalletLockStatus, getWalletProviderLabel } from '@/lib/walletProvider';
import type { WalletConnectorKey } from '@/config/wagmiConfig';
import { WALLET_CONNECTOR_NAMES } from '@/config/wagmiConfig';
import { LENDER_WALLET_OPTIONS } from '@/views/onboarding/walletPickerOptions';
import { confirmEmailChange, fetchUser, updateUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';
import AvatarUploadModal from '@/views/account/AvatarUploadModal';
import BaseNetworkSheet from '@/views/account/BaseNetworkSheet';
import EditBioInfoModal from '@/views/account/EditBioInfoModal';
import { useCreateInstantWallet, WALLET_FACE_GATE_ENABLED } from '@/lib/web3/openfort';
import ExportInstantWalletKey from '@/views/account/ExportInstantWalletKey';
import TwoFactorSettings from '@/views/account/TwoFactorSettings';
import WalletAccountInsights from '@/views/account/WalletAccountInsights';

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

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
   accountActivity: true,
   transactionActivity: true,
   moodengBlogs: false
};

function loadNotificationPrefs(): NotificationPrefs {
   try {
      const stored = window.localStorage?.getItem(NOTIFICATION_STORAGE_KEY);
      if (stored) {
         const parsed = JSON.parse(stored) as Partial<NotificationPrefs> | null;
         if (parsed && typeof parsed === 'object') {
            return {
               accountActivity:
                  typeof parsed.accountActivity === 'boolean'
                     ? parsed.accountActivity
                     : DEFAULT_NOTIFICATION_PREFS.accountActivity,
               transactionActivity:
                  typeof parsed.transactionActivity === 'boolean'
                     ? parsed.transactionActivity
                     : DEFAULT_NOTIFICATION_PREFS.transactionActivity,
               moodengBlogs:
                  typeof parsed.moodengBlogs === 'boolean' ? parsed.moodengBlogs : DEFAULT_NOTIFICATION_PREFS.moodengBlogs
            };
         }
      }
   } catch {
      return DEFAULT_NOTIFICATION_PREFS;
   }
   return DEFAULT_NOTIFICATION_PREFS;
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

// Detail-page field row: title + current value + inline action, designed to sit
// inside a SettingsGroup card (same row pattern as the Wallet / Security pages).
export function SettingsFieldRow({
   title,
   value,
   actionLabel,
   onAction,
   leading,
   id
}: {
   title: string;
   value: string;
   actionLabel?: string;
   onAction?: () => void;
   leading?: React.ReactNode;
   id?: string;
}) {
   return (
      <div id={id} className="flex min-h-[72px] items-center gap-md-2 px-md-3 py-md-2">
         {leading ? <span className="shrink-0">{leading}</span> : null}
         <div className="min-w-0 flex-1">
            <p className="text-md-b1 font-semibold text-md-heading">{title}</p>
            <p className="text-md-b2 font-medium text-md-neutral-1200 truncate">{value}</p>
         </div>
         {actionLabel && onAction ? (
            <button
               type="button"
               onClick={onAction}
               className="min-h-11 shrink-0 rounded-md-input px-md-1 text-md-b2 font-semibold text-md-primary-900 transition-colors duration-150 hover:bg-md-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900"
            >
               {actionLabel}
            </button>
         ) : null}
      </div>
   );
}

// ─── Toggle ───

export function Toggle({
   checked,
   onChange,
   label,
   disabled = false
}: {
   checked: boolean;
   onChange: (v: boolean) => void;
   label: string;
   disabled?: boolean;
}) {
   return (
      <button
         type="button"
         role="switch"
         aria-checked={checked}
         aria-label={label}
         disabled={disabled}
         onClick={() => onChange(!checked)}
         className={`relative h-6 w-[42px] shrink-0 rounded-md-pill border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 focus-visible:ring-offset-2 disabled:opacity-50 ${
            checked ? 'border-md-primary-100 bg-md-primary-900' : 'border-md-primary-300 bg-white'
         }`}
      >
         {/* Figma inverts the knob against the track: pale lavender on the purple
             "on" track, brand purple on the white "off" track. */}
         <span
            className={`absolute left-[2px] top-[2px] h-[18px] w-[18px] rounded-full transition-transform duration-200 ${
               checked ? 'translate-x-[18px] bg-md-primary-100' : 'translate-x-0 bg-md-primary-900'
            }`}
         />
      </button>
   );
}

type SettingsSectionKey = 'profile' | 'preferences' | 'security' | 'wallet' | 'notifications';

const SETTINGS_SECTION_KEYS: SettingsSectionKey[] = ['profile', 'preferences', 'security', 'wallet', 'notifications'];

const SETTINGS_SECTION_TITLES: Record<SettingsSectionKey, string> = {
   profile: 'Personal details',
   preferences: 'Appearance & language',
   security: 'Security & verification',
   wallet: 'Wallet',
   notifications: 'Notifications'
};

const SETTINGS_SECTION_DESCRIPTIONS: Record<SettingsSectionKey, string> = {
   profile: 'Keep your profile and contact details up to date.',
   preferences: 'These choices apply throughout Moodeng.',
   security: 'Manage sign-in security and identity checks.',
   wallet: 'Manage the wallet used for loans and repayments.',
   notifications: 'Choose which account and loan alerts you receive.'
};

const VERIFICATION_PRESENTATION: Record<
   VerificationUiState,
   { title: string; description: string; tone: 'success' | 'warning' | 'danger' }
> = {
   verified: {
      title: 'Identity verified',
      description: 'Your identity check is complete.',
      tone: 'success'
   },
   review: {
      title: 'Verification in review',
      description: 'Your identity check is being reviewed.',
      tone: 'warning'
   },
   processing: {
      title: 'Verification pending',
      description: 'Your submitted identity check is processing.',
      tone: 'warning'
   },
   unfinished: {
      title: 'Verification unfinished',
      description: 'Continue where you left off.',
      tone: 'warning'
   },
   declined: {
      title: 'Verification declined',
      description: 'Review the result and try again.',
      tone: 'danger'
   },
   duplicate: {
      title: 'Verification blocked',
      description: 'Open verification to review the issue.',
      tone: 'danger'
   },
   unverified: {
      title: 'Identity not verified',
      description: 'Complete an identity check to build account trust.',
      tone: 'danger'
   }
};

function isSettingsSectionKey(value: string | null): value is SettingsSectionKey {
   return value !== null && SETTINGS_SECTION_KEYS.includes(value as SettingsSectionKey);
}

function VerificationStateIcon({ state, className = 'size-4' }: { state: VerificationUiState; className?: string }) {
   const tone = VERIFICATION_PRESENTATION[state].tone;

   if (tone === 'success') {
      return <CheckCircle2 className={`${className} text-md-green-900`} strokeWidth={2.2} aria-hidden="true" />;
   }

   if (tone === 'warning') {
      return <Clock3 className={`${className} text-md-yellow-700`} strokeWidth={2.2} aria-hidden="true" />;
   }

   return <AlertCircle className={`${className} text-md-red-500`} strokeWidth={2.2} aria-hidden="true" />;
}

export function SettingsGroup({
   label,
   description,
   children
}: {
   label: string;
   description?: string;
   children: React.ReactNode;
}) {
   return (
      <section>
         {/* Section heading per the Figma settings spec (md-h5 in the dark heading
             colour, optional grey supporting copy beneath) — the same treatment
             Dashboard/RequestBoard/TransactionHistory/Support already use. */}
         <div className="mb-md-2 flex flex-col gap-md-0 px-1">
            <h2 className="text-md-h5 font-semibold text-md-heading">{label}</h2>
            {description ? <p className="text-md-b2 font-medium text-md-neutral-700">{description}</p> : null}
         </div>
         <div className="divide-y divide-md-neutral-400 overflow-hidden rounded-md-lg border border-md-neutral-600 bg-md-neutral-100 shadow-md-card">
            {children}
         </div>
      </section>
   );
}

export function SettingsRow({
   title,
   summary,
   icon,
   summaryIcon,
   iconStyle = 'standard',
   onClick
}: {
   title: string;
   summary: string;
   icon: React.ReactNode;
   summaryIcon?: React.ReactNode;
   iconStyle?: 'standard' | 'avatar';
   onClick: () => void;
}) {
   return (
      <button
         type="button"
         onClick={onClick}
         className="group flex min-h-[72px] w-full items-center gap-md-2 px-md-3 py-md-2 text-left transition-colors duration-150 hover:bg-md-primary-100/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-md-primary-900 active:bg-md-primary-100/70"
      >
         <span
            className={
               iconStyle === 'avatar'
                  ? 'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full'
                  : 'flex size-10 shrink-0 items-center justify-center rounded-md-input bg-md-primary-100 text-md-primary-1200'
            }
            aria-hidden="true"
         >
            {icon}
         </span>
         <span className="min-w-0 flex-1">
            <span className="block text-md-b1 font-semibold text-md-heading">{title}</span>
            <span className="mt-px flex min-w-0 items-center gap-1.5 text-md-b2 font-medium text-md-neutral-1200">
               {summaryIcon ? <span className="shrink-0">{summaryIcon}</span> : null}
               <span className="truncate">{summary}</span>
            </span>
         </span>
         <ChevronRight
            className="size-[18px] shrink-0 text-md-neutral-800 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-md-primary-900"
            aria-hidden="true"
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
   const { showToast } = useToast();
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
         showToast(TOAST_TYPES.SUCCESS, 'Password updated', 'Your password has been changed.');
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
            className="bg-white rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-md-3 items-center"
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
                  <div className="flex flex-col gap-md-3 w-full">
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
                  <div className="flex flex-col gap-md-3 w-full">
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
            className="bg-white rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-md-3 items-center"
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
            <div className="flex flex-col gap-md-3 w-full">
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

// ─── Change Wallet Modal ───

function ChangeWalletModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
   const { showToast } = useToast();
   const user = useSelector((state: RootState) => state.auth.user);
   const { address: connectedAddress, isConnected } = useAccount();
   const { connect, connectors, status: connectStatus, reset: resetConnect } = useConnect();
   const { openConnectModal } = useConnectModal();
   const { disconnectAsync } = useDisconnect();
   const instantWallet = useCreateInstantWallet('account-settings');
   const isBorrower = user?.userRole === 'borrower';
   // Lenders can always create an instant wallet — it's their "no app installed" path, and the
   // one-per-person face check is enforced server-side on mint, so it's offered wherever Openfort
   // is configured. Borrowers are the ones scoped to the Philippines: the instant wallet exists to
   // route around the PLDT/Smart ISP block on keys.coinbase.com, so outside PH they stay on the
   // Base path (soft client-side gate; server face-gate still enforces one-per-person on mint).
   const showInstantWallet =
      instantWallet.isConfigured && (!isBorrower || (WALLET_FACE_GATE_ENABLED && isLikelyPhilippines()));

   const [step, setStep] = useState<'choose' | 'connecting'>('choose');
   const [selectedKey, setSelectedKey] = useState<WalletConnectorKey | null>(null);
   const [isClearing, setIsClearing] = useState(false);
   const [openOtherWalletsWhenReady, setOpenOtherWalletsWhenReady] = useState(false);
   const [error, setError] = useState('');

   const previousWalletRef = useRef<string | null | undefined>(undefined);
   const walletChangeIntentRef = useRef<string | null>(null);

   const connectorsByName = useMemo(() => {
      const map = new Map<string, (typeof connectors)[number]>();
      connectors.forEach((c) => map.set(c.name, c));
      if (!map.has(WALLET_CONNECTOR_NAMES.coinbase)) {
         const baseConnector = getBaseAccountConnector(connectors);
         if (baseConnector) map.set(WALLET_CONNECTOR_NAMES.coinbase, baseConnector);
      }
      return map;
   }, [connectors]);

   // Record previous wallet and reset on open/close
   useEffect(() => {
      if (!isOpen) {
         setStep('choose');
         setSelectedKey(null);
         setOpenOtherWalletsWhenReady(false);
         setError('');
         previousWalletRef.current = undefined;
         walletChangeIntentRef.current = null;
         return;
      }
      previousWalletRef.current = user?.walletAddress ?? null;
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isOpen]);

   useEffect(() => {
      if (!isOpen || !openOtherWalletsWhenReady || !openConnectModal) return;
      openConnectModal();
      setOpenOtherWalletsWhenReady(false);
   }, [isOpen, openConnectModal, openOtherWalletsWhenReady]);

   useEffect(() => {
      if (!isOpen) return;

      const handleWalletChangeFailure = (event: Event) => {
         const detail = (event as CustomEvent<{ intentId?: string; message?: string }>).detail;
         if (!detail?.intentId || detail.intentId !== walletChangeIntentRef.current) return;

         walletChangeIntentRef.current = null;
         resetConnect();
         setOpenOtherWalletsWhenReady(false);
         setStep('choose');
         setError(detail.message || 'We could not save the new wallet. Your previous wallet is still saved.');
      };

      window.addEventListener(WALLET_CHANGE_FAILED_EVENT, handleWalletChangeFailure);
      return () => window.removeEventListener(WALLET_CHANGE_FAILED_EVENT, handleWalletChangeFailure);
   }, [isOpen, resetConnect]);

   // Auto-close when useWalletSync saves the new wallet
   useEffect(() => {
      if (!isOpen || step !== 'connecting') return;
      if (previousWalletRef.current === undefined) return;
      const previousAddress = previousWalletRef.current?.toLowerCase() ?? '';
      const savedAddress = user?.walletAddress?.toLowerCase() ?? '';
      const liveAddress = connectedAddress?.toLowerCase() ?? '';

      if (savedAddress && savedAddress !== previousAddress) {
         showToast(TOAST_TYPES.SUCCESS, 'Wallet changed', 'Your new wallet has been connected.');
         onClose();
         return;
      }

      if (connectStatus === 'success' && isConnected && liveAddress === previousAddress) {
         if (walletChangeIntentRef.current) completeWalletChangeIntent(walletChangeIntentRef.current);
         walletChangeIntentRef.current = null;
         showToast(TOAST_TYPES.SUCCESS, 'Wallet unchanged', 'You reconnected the same wallet.');
         onClose();
      }
   }, [connectedAddress, connectStatus, isConnected, isOpen, onClose, showToast, step, user?.walletAddress]);

   // Surface connection errors back to choose step
   useEffect(() => {
      if (step !== 'connecting' || connectStatus !== 'error') return;
      resetConnect();
      setStep('choose');
      const intentId = walletChangeIntentRef.current;
      if (intentId) cancelWalletChangeIntent(intentId);
      walletChangeIntentRef.current = null;
      void disconnectAsync().catch(() => undefined);
      setError('Connection was cancelled or failed. Your previous wallet is still saved.');
   }, [connectStatus, disconnectAsync, step, resetConnect]);

   // Avoid getting stuck on "Connecting…" forever if the wallet app never responds
   useEffect(() => {
      if (step !== 'connecting') return;
      const timeout = setTimeout(() => {
         resetConnect();
         setStep('choose');
         const intentId = walletChangeIntentRef.current;
         if (intentId) cancelWalletChangeIntent(intentId);
         walletChangeIntentRef.current = null;
         void disconnectAsync().catch(() => undefined);
         setError('Connection took too long. Your previous wallet is still saved.');
      }, 45000);
      return () => clearTimeout(timeout);
   }, [disconnectAsync, step, resetConnect]);

   const startWalletChange = () => {
      const intentId = beginWalletChangeIntent(previousWalletRef.current);
      walletChangeIntentRef.current = intentId;
      return intentId;
   };

   const handleConnectWithKey = async (key: WalletConnectorKey) => {
      setIsClearing(true);
      setError('');
      try {
         const connector = connectorsByName.get(WALLET_CONNECTOR_NAMES[key]);
         if (!connector) throw new Error(`${WALLET_CONNECTOR_NAMES[key]} is not available right now.`);
         startWalletChange();
         await disconnectAsync().catch(() => undefined);
         connect({ connector });
         setStep('connecting');
      } catch (err) {
         const intentId = walletChangeIntentRef.current;
         if (intentId) cancelWalletChangeIntent(intentId);
         walletChangeIntentRef.current = null;
         setError(err instanceof Error ? err.message : 'Failed to change wallet');
      } finally {
         setIsClearing(false);
      }
   };

   // RainbowKit exposes its connect modal only after the current live wallet is
   // disconnected. The saved address remains unchanged until a new one is confirmed.
   const handleConnectOther = () => {
      const intentId = startWalletChange();
      setStep('connecting');
      void disconnectAsync()
         .then(() => {
            if (walletChangeIntentRef.current === intentId) setOpenOtherWalletsWhenReady(true);
         })
         .catch((err) => {
            setStep('choose');
            if (walletChangeIntentRef.current === intentId) {
               cancelWalletChangeIntent(intentId);
               walletChangeIntentRef.current = null;
            }
            setError(err instanceof Error ? err.message : 'Failed to change wallet');
         });
   };

   const handleClose = () => {
      resetConnect();
      setStep('choose');
      setSelectedKey(null);
      setOpenOtherWalletsWhenReady(false);
      setError('');
      const intentId = walletChangeIntentRef.current;
      if (intentId) {
         cancelWalletChangeIntent(intentId);
         walletChangeIntentRef.current = null;
         void disconnectAsync().catch(() => undefined);
      }
      onClose();
   };

   if (!isOpen) return null;

   const isConnecting = isClearing || connectStatus === 'pending';

   return (
      <div
         className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-[#12071f]/50 px-5 pb-5 sm:pb-0"
         onClick={step === 'choose' ? handleClose : undefined}
      >
         <div
            className="bg-white rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-md-3"
            onClick={(e) => e.stopPropagation()}
         >
            {step === 'choose' ? (
               <>
                  <div className="flex flex-col gap-md-1 items-center text-center">
                     <h2 className="text-md-h4 font-semibold text-md-heading">Change Wallet</h2>
                     <p className="text-md-b1 text-md-neutral-1200">
                        {isBorrower
                           ? 'Choose a new Base Account. Your current wallet stays saved until the new one is confirmed.'
                           : 'Choose a new wallet. Your current wallet stays saved until the new one is confirmed.'}
                     </p>
                  </div>

                  {isBorrower ? (
                     <div className="flex flex-col gap-md-2">
                        <button
                           type="button"
                           disabled={isConnecting}
                           onClick={() => void handleConnectWithKey('coinbase')}
                           className="w-full py-md-3 px-md-4 bg-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-neutral-100 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                           {isConnecting ? 'Connecting...' : 'Connect Base Account'}
                           {!isConnecting ? (
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
                        {/* Base Account was the ONLY option here, which is the second half of
                            the dead end borrowers hit: a legacy Base borrower prompted to
                            "Confirm your Base Account" had no route to an Instant Wallet, only
                            back to the wallet they couldn't reach. */}
                        {showInstantWallet ? (
                           <button
                              type="button"
                              disabled={isConnecting || instantWallet.isCreating}
                              onClick={() => void instantWallet.createInstantWallet()}
                              className="w-full py-md-3 px-md-4 border border-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-primary-1200 disabled:opacity-50"
                           >
                              {instantWallet.isCreating ? 'Creating your wallet…' : 'Create an Instant Wallet instead'}
                           </button>
                        ) : null}
                     </div>
                  ) : (
                     <div className="flex flex-col gap-md-2">
                        {/* Instant Wallet as a first-class option here too, so a lender who lost
                            their wallet can create one straight from the picker without fully
                            disconnecting first. A card, not a tile — it CREATES a wallet rather
                            than connecting an existing one. Flag-gated like every other surface. */}
                        {showInstantWallet ? (
                           <>
                              <button
                                 type="button"
                                 disabled={isConnecting || instantWallet.isCreating}
                                 onClick={() => void instantWallet.createInstantWallet()}
                                 className="w-full py-md-3 px-md-4 bg-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-neutral-100 flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                 {instantWallet.isCreating ? 'Creating your wallet…' : 'Create Instant Wallet — no app needed'}
                              </button>
                              {instantWallet.error ? (
                                 <p className="text-md-b3 text-md-red-400 text-center w-full">{instantWallet.error}</p>
                              ) : null}
                              <div className="flex items-center gap-md-2">
                                 <span className="h-px flex-1 bg-md-neutral-600" />
                                 <span className="text-md-b3 font-medium text-md-neutral-800">or connect one you own</span>
                                 <span className="h-px flex-1 bg-md-neutral-600" />
                              </div>
                           </>
                        ) : null}
                        <div className="grid grid-cols-2 gap-md-2">
                           {LENDER_WALLET_OPTIONS.map((option) => {
                              const isSelected = selectedKey === option.key;
                              return (
                                 <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => setSelectedKey(option.key)}
                                    className={[
                                       'flex flex-col gap-md-1 items-start p-md-2 rounded-md-md border text-left transition-colors',
                                       isSelected
                                          ? 'bg-md-primary-900/10 border-md-primary-900'
                                          : 'bg-md-neutral-100 border-md-neutral-600'
                                    ].join(' ')}
                                 >
                                    <div className="size-7 rounded-md-xs inline-flex items-center justify-center overflow-hidden shrink-0">
                                       <img src={option.iconSrc} alt={option.name} className="size-7 object-contain" />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1">
                                       <span className="text-md-b2 font-semibold text-md-heading">{option.name}</span>
                                       {option.tag ? (
                                          <span className={`text-md-b4 font-semibold px-1 rounded-md-sm ${option.tag.bgClass} ${option.tag.textClass}`}>
                                             {option.tag.label}
                                          </span>
                                       ) : null}
                                    </div>
                                 </button>
                              );
                           })}
                           <button
                              type="button"
                              onClick={handleConnectOther}
                              disabled={isConnecting}
                              className="flex flex-col gap-md-1 items-start p-md-2 rounded-md-md border border-md-neutral-600 bg-md-neutral-100 text-left transition-colors disabled:opacity-50"
                           >
                              <div className="size-7 rounded-md-xs bg-md-slate-600 inline-flex items-center justify-center shrink-0">
                                 <span
                                    className="block size-4 bg-white"
                                    style={{
                                       ...ICON_MASK,
                                       WebkitMaskImage: "url('/icons/grid-4.svg')",
                                       maskImage: "url('/icons/grid-4.svg')"
                                    }}
                                 />
                              </div>
                              <div className="flex flex-wrap items-center gap-1">
                                 <span className="text-md-b2 font-semibold text-md-heading">Other Wallets</span>
                              </div>
                           </button>
                        </div>
                        <button
                           type="button"
                           disabled={!selectedKey || isConnecting}
                           onClick={() => selectedKey && void handleConnectWithKey(selectedKey)}
                           className="w-full py-md-3 px-md-4 bg-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-neutral-100 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                           {isConnecting ? 'Connecting...' : selectedKey ? 'Connect Wallet' : 'Select a wallet above'}
                           {!isConnecting && selectedKey ? (
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
                     </div>
                  )}

                  {error ? <p className="text-md-b3 text-md-red-400 text-center w-full">{error}</p> : null}

                  <button
                     type="button"
                     onClick={handleClose}
                     disabled={isConnecting}
                     className="w-full py-md-3 px-md-4 border border-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-primary-1200 disabled:opacity-50"
                  >
                     Cancel
                  </button>
               </>
            ) : (
               <>
                  <div className="flex flex-col gap-md-2 items-center text-center py-md-2">
                     <div className="size-12 rounded-full border-4 border-md-primary-900 border-t-transparent animate-spin" />
                     <h2 className="text-md-h4 font-semibold text-md-heading">Connecting…</h2>
                     <p className="text-md-b1 text-md-neutral-1200">Approve the connection in your wallet app.</p>
                  </div>
                  <button
                     type="button"
                     onClick={handleClose}
                     className="w-full py-md-3 px-md-4 border border-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-primary-1200"
                  >
                     Cancel
                  </button>
               </>
            )}
         </div>
      </div>
   );
}

// ─── Main Component ───

export default function AccountSettings() {
   const navigate = useNavigate();
   const location = useLocation();
   const [searchParams, setSearchParams] = useSearchParams();
   const { t, locale, locales } = useLocalization();
   const editTarget = searchParams.get('edit');
   const sectionTarget = searchParams.get('section');
   const activeSection: SettingsSectionKey | null = editTarget
      ? 'profile'
      : isSettingsSectionKey(sectionTarget)
        ? sectionTarget
        : null;
   const handledEditTargetRef = useRef<string | null>(null);
   const detailHeadingRef = useRef<HTMLHeadingElement>(null);
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const { connector, chain } = useAccount();
   const { disconnectAsync } = useDisconnect();
   const { isEmailPasswordUser } = useAuthProvider();
   const { isDarkMode, setMode } = useThemeMode();
   const { showToast } = useToast();

   const currentDisplayName = user?.displayName ?? user?.username ?? '';
   const [showNameModal, setShowNameModal] = useState(false);
   const [showPasswordModal, setShowPasswordModal] = useState(false);
   const [showEmailModal, setShowEmailModal] = useState(false);
   const [showTelegramAlertsModal, setShowTelegramAlertsModal] = useState(false);
   const [showBioInfoModal, setShowBioInfoModal] = useState(false);
   const [showAvatarModal, setShowAvatarModal] = useState(false);
   const [isSavingAvatar, setIsSavingAvatar] = useState(false);
   const [walletCopied, setWalletCopied] = useState(false);
   const [showChangeWalletModal, setShowChangeWalletModal] = useState(false);
   const [showBaseNetworkSheet, setShowBaseNetworkSheet] = useState(false);
   const [isDisconnectWalletPending, setIsDisconnectWalletPending] = useState(false);
   const [isSavingWallet, setIsSavingWallet] = useState(false);
   const [walletError, setWalletError] = useState('');
   const [walletSafetyWarning, setWalletSafetyWarning] = useState('');
   const [walletSafetyIntent, setWalletSafetyIntent] = useState<'change' | 'disconnect' | null>(null);
   // Set when a borrower with an outstanding loan tries to change/disconnect their wallet — the
   // action is refused (not just warned), because that wallet is their loan/repayment anchor.
   const [walletBlockedReason, setWalletBlockedReason] = useState('');
   const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(loadNotificationPrefs);

   const instantWallet = useCreateInstantWallet('account-settings');
   const hasWallet = Boolean(user?.walletAddress);
   // Borrowers can now create an Instant Wallet as well as connect a Base Account, so the old
   // "Connect Base Account" label misdescribed the screen it opens.
   const walletSetupLabel = 'Connect';
   const isBorrower = user?.userRole === 'borrower';
   const connectedWalletName = connector?.name;
   const baseWalletLock = getBaseWalletLockStatus(user);
   // Base Account OR an Openfort embedded wallet both count as a confirmed borrower wallet.
   const borrowerHasConfirmedBaseWallet = isBorrower && baseWalletLock.isConfirmedBorrowerWallet;
   const borrowerHasNonBaseWallet =
      isBorrower &&
      hasWallet &&
      Boolean(baseWalletLock.provider) &&
      baseWalletLock.provider !== 'unknown' &&
      !baseWalletLock.isConfirmedBorrowerWallet;
   const borrowerNeedsBaseWallet = isBorrower && !baseWalletLock.isConfirmedBorrowerWallet;
   const hasTelegramPlaceholderEmail = isTelegramPlaceholderEmail(user?.email);
   const emailFieldValue = hasTelegramPlaceholderEmail ? 'No email added' : user?.email || 'No email added';
   const emailActionLabel = hasTelegramPlaceholderEmail ? 'Add' : isEmailPasswordUser ? 'Change' : undefined;
   const canEditEmail = isEmailPasswordUser || hasTelegramPlaceholderEmail;
   const emailHelpCopy = hasTelegramPlaceholderEmail
      ? 'Add an email for account recovery and important alerts.'
      : 'Used for account recovery and important alerts.';
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
      if (!editTarget) {
         handledEditTargetRef.current = null;
         return;
      }
      if (handledEditTargetRef.current === editTarget) return;

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

      if (editTarget === 'bio') {
         setShowBioInfoModal(true);
      }
   }, [currentDisplayName, editTarget]);

   useEffect(() => {
      if (!activeSection) return;

      window.requestAnimationFrame(() => {
         window.scrollTo({ top: 0, behavior: 'auto' });
         detailHeadingRef.current?.focus({ preventScroll: true });
      });
   }, [activeSection]);

   useEffect(() => {
      setIsDisconnectWalletPending(false);
      setWalletError('');
   }, [user?.walletAddress]);

   const handleCopyWallet = async () => {
      if (!user?.walletAddress) return;
      await navigator.clipboard.writeText(user.walletAddress);
      setWalletCopied(true);
      setTimeout(() => setWalletCopied(false), 2000);
   };

   const checkWalletChangeSafety = useCallback(
      async (intent: 'change' | 'disconnect' = 'change'): Promise<{ blocked: boolean; warning?: string }> => {
         if (!user?.id) return { blocked: false };
         const supabase = getSupabaseBrowserClient();

         // Borrowers are BLOCKED (not just warned) while a loan they took out is still
         // outstanding. Their wallet is the on-chain anchor their loan and repayments are tied
         // to; disconnecting or swapping it mid-loan unlinks that anchor (and breaks their own
         // withdraw/repay views). Previously borrowers were exempted from this check entirely —
         // the exact group that most needs locking got a free pass.
         if (isBorrower) {
            const { data, error } = await supabase
               .from('loans')
               .select('id')
               .eq('borrower_user_id', user.id)
               .eq('loan_status', 'Lent')
               .or('repayment_status.is.null,repayment_status.neq.Paid');
            if (error || !data || data.length === 0) return { blocked: false };
            const loanWord = data.length === 1 ? 'loan' : 'loans';
            const verb = intent === 'disconnect' ? 'disconnect' : 'change';
            return {
               blocked: true,
               warning: `You have ${data.length} active ${loanWord} still to repay. You can't ${verb} your wallet until it's fully repaid — this is the wallet your loan and repayments are tied to.`
            };
         }

         // NOTE: the loans table is `loans` (there is no `loan_requests` table) — the old query here
         // silently errored, so this safety warning never fired. That gap is exactly how a lender ends
         // up thinking a repayment vanished after they switched wallets. Fetch the funding wallets of
         // any active (Lent, not fully repaid) loans so we can name where repayments will still land.
         const { data, error } = await supabase
            .from('loans')
            .select('lender_wallet')
            .eq('lender_user_id', user.id)
            .eq('loan_status', 'Lent')
            .or('repayment_status.is.null,repayment_status.neq.Paid');
         if (error || !data || data.length === 0) return { blocked: false };

         const wallets = [...new Set(data.map((row) => (row.lender_wallet ?? '').trim()).filter(Boolean))];
         const walletList = wallets.map((w) => truncateAddress(w)).join(', ');
         const loanWord = data.length === 1 ? 'loan' : 'loans';
         const walletClause = walletList
            ? ` Repayments will still arrive at the wallet you funded from (${walletList}), not the wallet you connect here.`
            : ' Repayments will still arrive at the wallet you funded each loan from, not the wallet you connect here.';
         const verb = intent === 'disconnect' ? 'Disconnecting' : 'Changing';
         return {
            blocked: false,
            warning: `You have ${data.length} active ${loanWord} being repaid.${walletClause} ${verb} your wallet here is safe. It only affects loans you fund from now on.`
         };
      },
      [user?.id, isBorrower]
   );

   const handleInitiateWalletChange = useCallback(async () => {
      setWalletSafetyWarning('');
      setWalletBlockedReason('');
      const { blocked, warning } = await checkWalletChangeSafety('change');
      if (blocked) {
         setWalletBlockedReason(warning ?? "You can't change your wallet while you have an active loan.");
         return;
      }
      if (warning) {
         setWalletSafetyIntent('change');
         setWalletSafetyWarning(warning);
      } else {
         setShowChangeWalletModal(true);
      }
   }, [checkWalletChangeSafety]);

   const handleInitiateWalletDisconnect = useCallback(async () => {
      setWalletError('');
      setWalletBlockedReason('');
      const { blocked, warning } = await checkWalletChangeSafety('disconnect');
      if (blocked) {
         setWalletBlockedReason(warning ?? "You can't disconnect your wallet while you have an active loan.");
         return;
      }
      // For lenders this is reassurance only — repayments for loans already funded keep flowing to
      // the funding wallet regardless of what happens here.
      setWalletSafetyIntent(null);
      setWalletSafetyWarning(warning ?? '');
      setIsDisconnectWalletPending(true);
   }, [checkWalletChangeSafety]);

   const handleRevertWalletChanges = () => {
      setIsDisconnectWalletPending(false);
      setWalletBlockedReason('');
      setWalletError('');
      setWalletSafetyWarning('');
      setWalletSafetyIntent(null);
   };

   const handleSaveWalletChanges = async () => {
      if (!isDisconnectWalletPending) {
         handleRevertWalletChanges();
         return;
      }

      setIsSavingWallet(true);
      setWalletError('');
      try {
         // Disconnect the live wallet FIRST and wait for it to settle. If we clear
         // the stored address before the wallet is actually disconnected, useWalletSync
         // sees a still-connected wallet with no stored address and immediately re-saves
         // it — which is why disconnect "didn't work" until the second attempt.
         await disconnectAsync().catch(() => undefined);

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

         showToast(TOAST_TYPES.SUCCESS, 'Wallet disconnected', 'Your wallet has been removed from this account.');
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
            showToast(TOAST_TYPES.SUCCESS, 'Photo updated', 'Your profile photo has been changed.');
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
      // Only assume Base for a borrower whose stored wallet has no resolvable provider (legacy
      // rows). Openfort resolves to 'openfort' → labelled "Instant Wallet", never forced to Base.
      assumeBaseAccount: isBorrower && hasWallet && !baseWalletLock.provider
   });
   // Show the Base logo whenever the wallet resolves to a Base Account — the icon must
   // track the label (not the borrower-only lock), so lenders on Base see it too.
   const isBaseAccountWallet = hasWallet && walletLabel === 'Base Account';
   const verificationState = getVerificationUiState(user);
   // Lenders don't do identity verification, so the whole "verification" story is hidden for
   // them — it only confused lenders who thought they had to verify before they could lend.
   const showIdentityVerification = isBorrower;
   const securitySectionTitle = showIdentityVerification ? 'Security & verification' : 'Security';
   const activeNotificationCount = Object.values(notifPrefs).filter(Boolean).length;
   const currentLanguage = locales.find((supportedLocale) => supportedLocale.code === locale)?.label ?? 'English';
   const sectionSummaries: Record<SettingsSectionKey, string> = {
      profile: hasTelegramPlaceholderEmail
         ? 'Add an email for recovery'
         : currentDisplayName
           ? `${currentDisplayName} · ${emailFieldValue}`
           : emailFieldValue,
      preferences: `${currentLanguage} · ${isDarkMode ? 'Dark' : 'Light'} mode`,
      security: showIdentityVerification
         ? verificationState === 'verified'
            ? 'Identity verified'
            : VERIFICATION_STATE_LABEL[verificationState]
         : isEmailPasswordUser
           ? 'Password & sign-in'
           : 'Sign-in',
      wallet: hasWallet ? `${walletLabel} · ${truncateAddress(user?.walletAddress || '')}` : 'No wallet connected',
      notifications: `${activeNotificationCount} of 3 preferences enabled`
   };

   const toggleNotif = (key: keyof NotificationPrefs) => {
      setNotifPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
   };

   const openSettingsSection = (section: SettingsSectionKey) => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('section', section);
      nextParams.delete('edit');
      const currentState =
         location.state && typeof location.state === 'object' ? (location.state as Record<string, unknown>) : {};
      navigate(
         { pathname: location.pathname, search: nextParams.toString() },
         { state: { ...currentState, settingsFromOverview: true } }
      );
      window.scrollTo({ top: 0, behavior: 'auto' });
   };

   const closeSettingsSection = () => {
      // Two ways to land on a section:
      //  1. Tapped a row in the settings overview (openSettingsSection sets
      //     `settingsFromOverview`) — back should return to that overview.
      //  2. Deep-linked straight into a section from elsewhere in the app, e.g.
      //     tapping your username on the request board (`/account/settings?edit=name`).
      //     The user never saw the overview, so back should return to wherever
      //     they came from — not strand them on the overview.
      // In both cases there is a real previous in-app history entry to pop.
      // react-router gives the first entry of a session the key 'default'; any
      // other key means we navigated here in-app and can safely go back.
      const cameFromOverview =
         location.state &&
         typeof location.state === 'object' &&
         (location.state as { settingsFromOverview?: boolean }).settingsFromOverview;

      if (cameFromOverview || location.key !== 'default') {
         navigate(-1);
         return;
      }

      // Hard-loaded directly onto a section (no in-app history to pop): fall back
      // to revealing the settings overview in place.
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('section');
      nextParams.delete('edit');
      setSearchParams(nextParams, { replace: true });
      window.scrollTo({ top: 0, behavior: 'auto' });
   };

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="mx-auto flex max-w-[440px] flex-col pb-28">
            <header className="sticky top-0 z-20 flex min-h-[64px] items-center gap-md-2 border-b border-md-neutral-400 bg-md-neutral-200 px-md-5">
               <button
                  type="button"
                  onClick={activeSection ? closeSettingsSection : () => navigate('/account')}
                  className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-md-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900"
                  aria-label={activeSection ? 'Back to settings' : 'Back to account'}
               >
                  <ArrowLeft className="size-6 text-md-heading" strokeWidth={2} aria-hidden="true" />
               </button>
               {/* Top-level title is md-h3 per the Figma spec (28px) and the app's
                   page-title standard; sub-page titles stay md-h6 so longer names
                   ("Security & verification") don't crowd the back button on mobile. */}
               <h1
                  ref={detailHeadingRef}
                  tabIndex={activeSection ? -1 : undefined}
                  className={`truncate font-semibold text-md-heading outline-none ${
                     activeSection ? 'text-md-h6' : 'text-md-h3'
                  }`}
               >
                  {activeSection
                     ? activeSection === 'security'
                        ? securitySectionTitle
                        : SETTINGS_SECTION_TITLES[activeSection]
                     : 'Account settings'}
               </h1>
            </header>

            {!activeSection ? (
               <main className="flex flex-col gap-6 px-md-4 py-md-5">
                  <SettingsGroup label="Account">
                     <SettingsRow
                        title="Personal details"
                        summary={sectionSummaries.profile}
                        icon={<UserAvatar size={40} clickable={false} />}
                        iconStyle="avatar"
                        onClick={() => openSettingsSection('profile')}
                     />
                     <SettingsRow
                        title={securitySectionTitle}
                        summary={sectionSummaries.security}
                        icon={<img src="/icons/security-lock-3d.png" alt="" className="size-7 object-contain" />}
                        summaryIcon={showIdentityVerification ? <VerificationStateIcon state={verificationState} /> : undefined}
                        onClick={() => openSettingsSection('security')}
                     />
                  </SettingsGroup>

                  <SettingsGroup label="Money">
                     <SettingsRow
                        title="Wallet"
                        summary={sectionSummaries.wallet}
                        icon={
                           isBaseAccountWallet ? (
                              <img src="/icons/base-account.svg" alt="" className="size-9 rounded-md-md" />
                           ) : (
                              <WalletCards size={20} strokeWidth={1.8} />
                           )
                        }
                        onClick={() => openSettingsSection('wallet')}
                     />
                  </SettingsGroup>

                  <SettingsGroup label="Preferences">
                     <SettingsRow
                        title="Notifications"
                        summary={sectionSummaries.notifications}
                        icon={<img src="/icons/notification-bell-3d.png" alt="" className="size-7 object-contain" />}
                        onClick={() => openSettingsSection('notifications')}
                     />
                     <SettingsRow
                        title="Appearance & language"
                        summary={sectionSummaries.preferences}
                        icon={<img src="/icons/translation-3d.png" alt="" className="size-7 object-contain" />}
                        onClick={() => openSettingsSection('preferences')}
                     />
                  </SettingsGroup>
               </main>
            ) : (
               <main className="px-md-4 pb-md-6 pt-md-4">
                  <p className="mb-md-5 px-1 text-md-b2 font-medium leading-5 text-md-neutral-1200">
                     {activeSection === 'wallet'
                        ? isBorrower
                           ? 'This wallet receives your loans and records your repayments.'
                           : 'This wallet funds new loans. Existing repayments still return to the wallet used for each loan.'
                        : activeSection === 'security' && !showIdentityVerification
                          ? 'Manage how you sign in to Moodeng.'
                          : SETTINGS_SECTION_DESCRIPTIONS[activeSection]}
                  </p>

                  {activeSection === 'profile' ? (
                     <div className="flex flex-col gap-md-4">
                        <SettingsGroup label="Profile">
                           <SettingsFieldRow
                              id="avatar-section"
                              leading={<EditableAvatar size={40} onClick={() => setShowAvatarModal(true)} />}
                              title="Profile photo"
                              value="Helps people recognize you"
                              actionLabel="Change"
                              onAction={() => setShowAvatarModal(true)}
                           />
                           <SettingsFieldRow
                              id="display-name-section"
                              title="Display name"
                              value={currentDisplayName || 'Not set'}
                              actionLabel="Change"
                              onAction={() => setShowNameModal(true)}
                           />
                        </SettingsGroup>

                        <SettingsGroup label="Contact" description={emailHelpCopy}>
                           <SettingsFieldRow
                              title="Email address"
                              value={emailFieldValue}
                              actionLabel={canEditEmail ? emailActionLabel : undefined}
                              onAction={canEditEmail ? () => setShowEmailModal(true) : undefined}
                           />
                        </SettingsGroup>

                        {isBorrower ? (
                           <SettingsGroup label="About you">
                              <SettingsFieldRow
                                 title="Bio"
                                 value="Work, income, and what you need help with"
                                 actionLabel="Change"
                                 onAction={() => setShowBioInfoModal(true)}
                              />
                           </SettingsGroup>
                        ) : null}
                     </div>
                  ) : null}

               {/* Preferences (Appearance + Language) */}
                  {activeSection === 'preferences' ? (
                     <div className="flex flex-col gap-md-4">
                        <SettingsGroup label="Appearance">
                           <div className="flex min-h-[72px] items-center justify-between gap-md-3 px-md-3 py-md-2">
                              <div className="min-w-0">
                                 <p className="text-md-b1 font-semibold text-md-heading">Dark mode</p>
                                 <p className="text-md-b2 font-medium text-md-neutral-1200">Use darker surfaces throughout Moodeng</p>
                              </div>
                              <Toggle
                                 checked={isDarkMode}
                                 onChange={(checked) => setMode(checked ? 'dark' : 'light')}
                                 label="Use dark mode"
                              />
                           </div>
                        </SettingsGroup>

                        <div className="flex flex-col gap-md-0">
                           <h2 className="px-1 text-md-h5 font-semibold text-md-heading">{t('language.label')}</h2>
                           <p className="mb-md-1 px-1 text-md-b2 font-medium text-md-neutral-700">{t('language.settingsDescription')}</p>
                           <LanguageSwitcher tone="light" variant="full" />
                        </div>
                     </div>
                  ) : null}

                  {activeSection === 'security' ? (
                     <div className="flex flex-col gap-md-4">
                        {isEmailPasswordUser ? (
                           <SettingsGroup label="Sign-in">
                              <div className="flex min-h-[68px] items-center gap-md-2 px-md-3 py-md-2">
                                 <div className="min-w-0 flex-1">
                                    <p className="text-md-b1 font-semibold text-md-heading">Password</p>
                                    <p className="text-md-b2 font-medium tracking-[0.12em] text-md-neutral-1200">••••••••</p>
                                 </div>
                                 <button
                                    type="button"
                                    onClick={() => setShowPasswordModal(true)}
                                    className="min-h-11 shrink-0 rounded-md-input px-md-1 text-md-b2 font-semibold text-md-primary-900 transition-colors duration-150 hover:bg-md-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900"
                                 >
                                    Change
                                 </button>
                              </div>
                           </SettingsGroup>
                        ) : null}

                        {showIdentityVerification ? (
                           <SettingsGroup label="Identity verification">
                              <div className="flex min-h-[76px] items-center gap-md-2 px-md-3 py-md-2">
                                 <span
                                    className={`flex size-10 shrink-0 items-center justify-center rounded-md-input ${
                                       VERIFICATION_PRESENTATION[verificationState].tone === 'success'
                                          ? 'bg-md-green-100'
                                          : VERIFICATION_PRESENTATION[verificationState].tone === 'warning'
                                            ? 'bg-md-yellow-100'
                                            : 'bg-md-red-100'
                                    }`}
                                 >
                                    <VerificationStateIcon state={verificationState} className="size-5" />
                                 </span>
                                 <div className="min-w-0 flex-1">
                                    <p className="text-md-b1 font-semibold text-md-heading">
                                       {VERIFICATION_PRESENTATION[verificationState].title}
                                    </p>
                                    <p className="text-md-b2 font-medium text-md-neutral-1200">
                                       {VERIFICATION_PRESENTATION[verificationState].description}
                                    </p>
                                 </div>
                                 {verificationState === 'verified' ? null : (
                                    <button
                                       type="button"
                                       onClick={() => navigate('/verify')}
                                       className="min-h-11 shrink-0 rounded-md-input px-md-1 text-md-b2 font-semibold text-md-primary-900 transition-colors duration-150 hover:bg-md-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900"
                                    >
                                       {verificationState === 'unverified' ? 'Verify' : 'View'}
                                    </button>
                                 )}
                              </div>
                           </SettingsGroup>
                        ) : null}

                        <TwoFactorSettings />
                     </div>
                  ) : null}

                  {activeSection === 'wallet' ? (
                     <div className="flex flex-col gap-md-4">
                        <SettingsGroup label="Connected wallet">
                           <div className="flex min-h-[72px] items-center gap-md-2 px-md-3 py-md-2">
                              <span className="flex size-10 shrink-0 items-center justify-center rounded-md-input bg-md-primary-100">
                                 {isBaseAccountWallet ? (
                                    <img src="/icons/base-account.svg" alt="" className="size-9 rounded-md-md" />
                                 ) : (
                                    <WalletCards className="size-5 text-md-neutral-1200" strokeWidth={1.8} aria-hidden="true" />
                                 )}
                              </span>
                              {hasWallet ? (
                                 <>
                                    <div className="min-w-0 flex-1">
                                       <p className="truncate text-md-b1 font-semibold text-md-heading">{walletLabel}</p>
                                       <p className="truncate text-md-b2 font-medium text-md-neutral-1200">
                                          {truncateAddress(user?.walletAddress || '')}
                                       </p>
                                    </div>
                                    <button
                                       type="button"
                                       onClick={handleCopyWallet}
                                       title="Copy wallet address"
                                       className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-md-input px-md-1 text-md-b2 font-semibold text-md-blue-800 transition-colors duration-150 hover:bg-md-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-blue-800"
                                       aria-label="Copy wallet address"
                                    >
                                       {walletCopied ? (
                                          'Copied'
                                       ) : (
                                          <span
                                             className="block size-5 bg-md-blue-800"
                                             style={{
                                                ...ICON_MASK,
                                                WebkitMaskImage: "url('/icons/copy.svg')",
                                                maskImage: "url('/icons/copy.svg')"
                                             }}
                                             aria-hidden="true"
                                          />
                                       )}
                                    </button>
                                 </>
                              ) : (
                                 <>
                                    <div className="min-w-0 flex-1">
                                       <p className="text-md-b1 font-semibold text-md-heading">No wallet connected</p>
                                       <p className="text-md-b2 font-medium text-md-neutral-1200">Connect a wallet to continue</p>
                                    </div>
                                    <button
                                       type="button"
                                       onClick={() => navigate('/onboarding/wallet')}
                                       className="min-h-11 shrink-0 rounded-md-input px-md-1 text-md-b2 font-semibold text-md-primary-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900"
                                    >
                                       {walletSetupLabel}
                                    </button>
                                 </>
                              )}
                           </div>

                           {/* The way back after a disconnect. Both roles, and deliberately here
                               rather than only in onboarding: disconnecting is exactly when
                               someone discovers they have no wallet app to reconnect with, and
                               before this the only offer was "connect one you already own". */}
                           {!hasWallet &&
                           instantWallet.isConfigured &&
                           (!isBorrower || (WALLET_FACE_GATE_ENABLED && isLikelyPhilippines(locale))) ? (
                              <div className="flex flex-col gap-md-2 border-t border-md-neutral-300 px-md-3 py-md-3">
                                 <div className="flex items-start gap-md-2">
                                    <img src="/hippos/hippo-wallet.png" alt="" className="size-9 shrink-0 object-contain" />
                                    <div className="min-w-0 flex-1">
                                       <p className="text-md-b1 font-semibold text-md-heading">No wallet app? Create one</p>
                                       <p className="text-md-b2 font-medium leading-5 text-md-neutral-1200">
                                          An Instant Wallet is made from your Moodeng login — no app, no seed phrase — and the
                                          key is yours to export anytime.
                                       </p>
                                    </div>
                                 </div>
                                 <button
                                    type="button"
                                    onClick={() => void instantWallet.createInstantWallet()}
                                    disabled={instantWallet.isCreating}
                                    className="inline-flex min-h-11 w-full items-center justify-center rounded-md-lg bg-md-primary-1200 px-md-4 py-md-2 text-md-b1 font-semibold text-md-neutral-100 disabled:opacity-60 active:scale-[0.99]"
                                 >
                                    {instantWallet.isCreating ? 'Creating your wallet…' : 'Create Instant Wallet'}
                                 </button>
                                 <p className="text-md-b2 font-medium text-md-neutral-1200">
                                    Includes a ten-second face check, so instant wallets stay one per person.
                                 </p>
                                 {instantWallet.error ? (
                                    <p className="text-md-b2 font-medium text-md-red-500">{instantWallet.error}</p>
                                 ) : null}
                              </div>
                           ) : null}

                           {hasWallet ? (
                              <button
                                 type="button"
                                 onClick={() => setShowBaseNetworkSheet(true)}
                                 aria-haspopup="dialog"
                                 className="flex min-h-[52px] w-full items-center justify-between gap-md-2 rounded-md-md px-md-3 py-md-1 text-left transition-colors hover:bg-md-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-md-primary-900 active:bg-md-neutral-200"
                              >
                                 <span className="text-md-b2 font-medium text-md-neutral-1200">Network</span>
                                 <span className="flex items-center gap-1.5 text-md-b2 font-semibold text-md-heading">
                                    <img src="/icons/base-account.svg" alt="" className="size-4 rounded-md-sm" />
                                    {chain?.name || 'Base'}
                                    <ChevronRight className="size-4 text-md-neutral-800" aria-hidden="true" />
                                 </span>
                              </button>
                           ) : null}

                           {borrowerHasConfirmedBaseWallet ? (
                              <div className="flex items-start gap-md-2 px-md-3 py-md-2">
                                 <img src="/icons/verified-check-3d.png" alt="" className="mt-0.5 size-6 shrink-0 object-contain" />
                                 <div className="min-w-0 flex-1">
                                    <p className="text-md-b2 font-semibold text-md-heading">{walletLabel} confirmed</p>
                                    <p className="text-md-b2 font-medium leading-5 text-md-neutral-1200">
                                       {baseWalletLock.isConfirmedOpenfort
                                          ? 'Ready to receive loans and record repayments.'
                                          : 'Ready for your Moodeng loans and repayment history.'}
                                    </p>
                                    {baseWalletLock.isConfirmedOpenfort ? (
                                       <div className="mt-md-2">
                                          <ExportInstantWalletKey />
                                       </div>
                                    ) : null}
                                 </div>
                              </div>
                           ) : null}
                        </SettingsGroup>

                        {user.id !== '' ? (
                           <WalletAccountInsights
                              userId={user.id}
                              address={user.walletAddress}
                              role={isBorrower ? 'borrower' : 'lender'}
                              preview={import.meta.env.DEV ? user.id === 'preview-borrower' : false}
                           />
                        ) : null}

                        {hasWallet && !isDisconnectWalletPending ? (
                           <button
                              type="button"
                              onClick={handleInitiateWalletChange}
                              className="min-h-[48px] rounded-md-lg border border-md-primary-900 bg-md-neutral-100 px-md-3 py-md-2 text-md-b2 font-semibold text-md-primary-900 transition-colors duration-150 hover:bg-md-primary-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900 active:scale-[0.99]"
                           >
                              Change wallet
                           </button>
                        ) : null}

                        {walletBlockedReason ? (
                           <div className="flex flex-col gap-md-2 rounded-md-lg border border-md-yellow-700 bg-md-yellow-100 p-md-3">
                              <p className="text-md-b2 font-semibold text-md-heading">Wallet locked while you have an active loan</p>
                              <p className="text-md-b2 font-medium leading-5 text-md-heading">{walletBlockedReason}</p>
                              <button
                                 type="button"
                                 onClick={() => setWalletBlockedReason('')}
                                 className="min-h-11 self-start rounded-md-lg border border-md-primary-900 bg-md-neutral-100 px-md-3 py-md-2 text-md-b2 font-semibold text-md-primary-900"
                              >
                                 OK
                              </button>
                           </div>
                        ) : null}

                        {isDisconnectWalletPending ? (
                           <div className="flex flex-col gap-md-2 rounded-md-lg border border-md-red-100 bg-md-red-100 p-md-3">
                              <p className="text-md-b1 font-semibold text-md-heading">Disconnect wallet?</p>
                              <p className="text-md-b2 font-medium leading-5 text-md-heading">
                                 {isBorrower
                                    ? 'This removes your saved Base Account. You will need to connect one again before borrowing or repaying.'
                                    : 'This removes the wallet from your account. You can reconnect it anytime.'}
                              </p>
                              {!isBorrower && walletSafetyWarning ? (
                                 <p className="text-md-b2 font-medium leading-5 text-md-heading">{walletSafetyWarning}</p>
                              ) : null}
                              {walletError ? <p className="text-md-b2 font-medium text-md-red-500">{walletError}</p> : null}
                              <div className="grid grid-cols-2 gap-md-2">
                                 <button
                                    type="button"
                                    onClick={handleRevertWalletChanges}
                                    disabled={isSavingWallet}
                                    className="min-h-11 rounded-md-lg border border-md-primary-900 bg-md-neutral-100 px-md-3 py-md-2 text-md-b2 font-semibold text-md-primary-900 disabled:opacity-60"
                                 >
                                    Cancel
                                 </button>
                                 <button
                                    type="button"
                                    onClick={handleSaveWalletChanges}
                                    disabled={isSavingWallet}
                                    className="min-h-11 rounded-md-lg bg-md-red-500 px-md-3 py-md-2 text-md-b2 font-semibold text-md-neutral-100 disabled:opacity-60"
                                 >
                                    {isSavingWallet ? 'Saving...' : 'Disconnect'}
                                 </button>
                              </div>
                           </div>
                        ) : null}

                        {borrowerNeedsBaseWallet && hasWallet ? (
                           <div className="flex flex-col gap-md-2 rounded-md-lg border border-md-primary-900 bg-md-primary-100 p-md-3">
                              <div className="flex items-start gap-md-2">
                                 <img src="/icons/base-account.svg" alt="" className="size-9 shrink-0 rounded-md-md" />
                                 <div className="flex min-w-0 flex-1 flex-col gap-md-0">
                                    <p className="text-md-b1 font-semibold text-md-heading">Confirm your Base Account</p>
                                    <p className="text-md-b2 font-medium text-md-heading">
                                       {borrowerHasNonBaseWallet
                                          ? `Your account is using ${walletLabel}. Connect a Base Account so loans and repayments use the right wallet.`
                                          : 'Reconnect and confirm this is a Base Account before you borrow or repay.'}
                                    </p>
                                 </div>
                              </div>
                              <button
                                 type="button"
                                 onClick={() => setShowChangeWalletModal(true)}
                                 className="inline-flex min-h-11 w-full items-center justify-center rounded-md-lg bg-md-primary-1200 px-md-4 py-md-2 text-md-b1 font-semibold text-md-neutral-100 active:scale-[0.99]"
                              >
                                 Confirm Base Account
                              </button>
                           </div>
                        ) : null}

                        {!isBorrower && hasWallet && walletSafetyWarning && walletSafetyIntent === 'change' ? (
                           <div className="flex flex-col gap-md-2 rounded-md-lg border border-md-yellow-700 bg-md-yellow-100 p-md-3">
                              <p className="text-md-b2 font-semibold text-md-heading">You have active loans</p>
                              <p className="text-md-b2 font-medium leading-5 text-md-heading">{walletSafetyWarning}</p>
                              <div className="grid grid-cols-2 gap-md-2">
                                 <button
                                    type="button"
                                    onClick={handleRevertWalletChanges}
                                    className="min-h-11 rounded-md-lg border border-md-primary-900 bg-md-neutral-100 px-md-3 py-md-2 text-md-b2 font-semibold text-md-primary-900"
                                 >
                                    Cancel
                                 </button>
                                 <button
                                    type="button"
                                    onClick={() => {
                                       setWalletSafetyWarning('');
                                       setWalletSafetyIntent(null);
                                       setShowChangeWalletModal(true);
                                    }}
                                    className="min-h-11 rounded-md-lg bg-md-primary-1200 px-md-3 py-md-2 text-md-b2 font-semibold text-md-neutral-100"
                                 >
                                    Change anyway
                                 </button>
                              </div>
                           </div>
                        ) : null}

                        {hasWallet && !isDisconnectWalletPending ? (
                           <SettingsGroup label="Wallet access">
                              <button
                                 type="button"
                                 onClick={handleInitiateWalletDisconnect}
                                 className="group flex min-h-[68px] w-full items-center gap-md-2 px-md-3 py-md-2 text-left transition-colors duration-150 hover:bg-md-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-md-red-500"
                              >
                                 <span className="min-w-0 flex-1">
                                    <span className="block text-md-b1 font-semibold text-md-red-500">Disconnect wallet</span>
                                    <span className="block truncate text-md-b2 font-medium text-md-neutral-1200">
                                       {isBorrower
                                          ? 'Remove this saved wallet from your account'
                                          : 'Stop using this wallet for new loans'}
                                    </span>
                                 </span>
                                 <ChevronRight
                                    className="size-[18px] shrink-0 text-md-red-500 transition-transform duration-150 group-hover:translate-x-0.5"
                                    aria-hidden="true"
                                 />
                              </button>
                           </SettingsGroup>
                        ) : null}
                     </div>
                  ) : null}

                  {activeSection === 'notifications' ? (
                     <div className="flex flex-col gap-md-4">
                        {hasTelegramPlaceholderEmail ? (
                           <p className="px-1 text-md-b2 font-medium leading-5 text-md-neutral-1200">
                              Add an email in Personal details to receive email alerts.
                           </p>
                        ) : null}

                        <SettingsGroup label="Channels">
                           <div className="flex min-h-[72px] items-center gap-md-2 px-md-3 py-md-2">
                              <span className="flex size-10 shrink-0 items-center justify-center rounded-md-input bg-md-primary-100">
                                 <span
                                    className="size-7 bg-[#229ED9]"
                                    style={{
                                       ...ICON_MASK,
                                       WebkitMaskImage: "url('/icons/telegram.svg')",
                                       maskImage: "url('/icons/telegram.svg')"
                                    }}
                                    aria-hidden="true"
                                 />
                              </span>
                              <div className="min-w-0 flex-1">
                                 <p className="text-md-b1 font-semibold text-md-heading">Telegram</p>
                                 <p className="truncate text-md-b2 font-medium text-md-neutral-1200">{telegramAlertsValue}</p>
                              </div>
                              {user?.chatId ? (
                                 <CheckCircle2 className="size-5 shrink-0 text-md-green-900" strokeWidth={2.2} aria-label="Connected" />
                              ) : (
                                 <button
                                    type="button"
                                    onClick={() => setShowTelegramAlertsModal(true)}
                                    className="min-h-11 shrink-0 rounded-md-input px-md-1 text-md-b2 font-semibold text-md-primary-900 transition-colors duration-150 hover:bg-md-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary-900"
                                 >
                                    Connect
                                 </button>
                              )}
                           </div>
                        </SettingsGroup>

                        <SettingsGroup label="Alert types">
                           <div className="flex min-h-[72px] items-center justify-between gap-md-3 px-md-3 py-md-2">
                              <div className="min-w-0">
                                 <p className="text-md-b1 font-semibold text-md-heading">Account activity</p>
                                 <p className="text-md-b2 font-medium text-md-neutral-1200">Security and account updates</p>
                              </div>
                              <Toggle
                                 checked={notifPrefs.accountActivity}
                                 onChange={() => toggleNotif('accountActivity')}
                                 label="Account activity notifications"
                              />
                           </div>

                           <div className="flex min-h-[72px] items-center justify-between gap-md-3 px-md-3 py-md-2">
                              <div className="min-w-0">
                                 <p className="text-md-b1 font-semibold text-md-heading">Loan activity</p>
                                 <p className="text-md-b2 font-medium text-md-neutral-1200">Funding, repayments, and due dates</p>
                              </div>
                              <Toggle
                                 checked={notifPrefs.transactionActivity}
                                 onChange={() => toggleNotif('transactionActivity')}
                                 label="Loan activity notifications"
                              />
                           </div>

                           <div className="flex min-h-[72px] items-center justify-between gap-md-3 px-md-3 py-md-2">
                              <div className="min-w-0">
                                 <p className="text-md-b1 font-semibold text-md-heading">Moodeng news</p>
                                 <p className="text-md-b2 font-medium text-md-neutral-1200">Occasional product updates</p>
                              </div>
                              <Toggle
                                 checked={notifPrefs.moodengBlogs}
                                 onChange={() => toggleNotif('moodengBlogs')}
                                 label="Moodeng news notifications"
                              />
                           </div>
                        </SettingsGroup>
                     </div>
                  ) : null}
               </main>
            )}
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
         <ChangeWalletModal isOpen={showChangeWalletModal} onClose={() => setShowChangeWalletModal(false)} />
         <BaseNetworkSheet isOpen={showBaseNetworkSheet} onClose={() => setShowBaseNetworkSheet(false)} />
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
