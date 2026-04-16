import { useEffect, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';

import UserAvatar from '@/components/UserAvatar';
import { useAuthProvider } from '@/hooks/useAuthProvider';
import { updateUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

const ICON_MASK: React.CSSProperties = {
   WebkitMaskSize: 'contain',
   maskSize: 'contain',
   WebkitMaskRepeat: 'no-repeat',
   maskRepeat: 'no-repeat',
   WebkitMaskPosition: 'center',
   maskPosition: 'center',
};

const NOTIFICATION_STORAGE_KEY = 'md_notification_prefs';

interface NotificationPrefs {
   accountActivity: boolean;
   transactionActivity: boolean;
   moodengBlogs: boolean;
}

function loadNotificationPrefs(): NotificationPrefs {
   const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
   if (stored) {
      return JSON.parse(stored) as NotificationPrefs;
   }
   return { accountActivity: true, transactionActivity: true, moodengBlogs: false };
}

// ─── Reusable field ───

function ReadOnlyField({ label, value, actionLabel, onAction }: {
   label: string;
   value: string;
   actionLabel?: string;
   onAction?: () => void;
}) {
   return (
      <div className="flex flex-col gap-md-1 w-full">
         <p className="text-md-b2 font-semibold text-md-heading">{label}</p>
         <div className="flex items-center justify-between bg-md-neutral-100 border border-md-neutral-600 rounded-md-input shadow-md-card px-md-3 py-md-2 overflow-hidden">
            <span className="text-md-b1 text-md-neutral-1200 truncate">{value}</span>
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

function PasswordInput({ label, value, onChange, placeholder }: {
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
                     WebkitMaskImage: `url('/icons/${visible ? 'eye-off' : 'eye'}.svg')`,
                     maskImage: `url('/icons/${visible ? 'eye-off' : 'eye'}.svg')`,
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

      setIsSubmitting(true);
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
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-5" onClick={handleClose}>
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
                  <PasswordInput label="Confirm your new password" value={confirmPassword} onChange={setConfirmPassword} placeholder="******" />
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
               {!isSubmitting && (
                  <div
                     className="w-6 h-6 bg-md-neutral-100"
                     style={{
                        ...ICON_MASK,
                        WebkitMaskImage: "url('/icons/chevron-right.svg')",
                        maskImage: "url('/icons/chevron-right.svg')",
                     }}
                  />
               )}
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
   const [newEmail, setNewEmail] = useState('');
   const [confirmEmail, setConfirmEmail] = useState('');
   const [error, setError] = useState('');
   const [isSubmitting, setIsSubmitting] = useState(false);

   const resetForm = () => {
      setNewEmail('');
      setConfirmEmail('');
      setError('');
   };

   const handleClose = () => {
      resetForm();
      onClose();
   };

   const handleSubmit = async () => {
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
      const result = await dispatch(updateUser({ email: newEmail }));
      setIsSubmitting(false);

      if (updateUser.fulfilled.match(result)) {
         handleClose();
      } else {
         setError(result.error?.message || 'Failed to update email');
      }
   };

   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-5" onClick={handleClose}>
         <div
            className="bg-white rounded-md-lg p-md-4 w-full max-w-modal flex flex-col gap-[17px] items-center"
            onClick={(e) => e.stopPropagation()}
         >
            <div className="flex flex-col gap-md-5 items-center w-full">
               <h2 className="text-md-h4 font-semibold text-md-heading text-center">Change Email Address</h2>
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
                  onClick={handleSubmit}
                  className="w-full py-md-3 px-md-4 bg-md-primary-1200 rounded-md-lg text-md-b1 font-semibold text-md-neutral-100 flex items-center justify-center gap-2 disabled:opacity-50"
               >
                  {isSubmitting ? 'Updating...' : 'Confirm email change'}
                  {!isSubmitting && (
                     <div
                        className="w-6 h-6 bg-md-neutral-100"
                        style={{
                           ...ICON_MASK,
                           WebkitMaskImage: "url('/icons/chevron-right.svg')",
                           maskImage: "url('/icons/chevron-right.svg')",
                        }}
                     />
                  )}
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
      </div>
   );
}

// ─── Main Component ───

export default function AccountSettings() {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const { connector, chain } = useAccount();
   const { isEmailPasswordUser } = useAuthProvider();

   const currentDisplayName = user?.displayName ?? user?.username ?? '';
   const [isEditingName, setIsEditingName] = useState(false);
   const [editName, setEditName] = useState(currentDisplayName);
   const [isSavingName, setIsSavingName] = useState(false);
   const [showPasswordModal, setShowPasswordModal] = useState(false);
   const [showEmailModal, setShowEmailModal] = useState(false);
   const [walletCopied, setWalletCopied] = useState(false);
   const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(loadNotificationPrefs);

   const hasWallet = Boolean(user?.walletAddress);

   useEffect(() => {
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notifPrefs));
   }, [notifPrefs]);

   const handleSaveName = async () => {
      const trimmed = editName.trim();
      if (!trimmed || trimmed === currentDisplayName) {
         setIsEditingName(false);
         return;
      }
      setIsSavingName(true);
      await dispatch(updateUser({ displayName: trimmed }));
      setIsSavingName(false);
      setIsEditingName(false);
   };

   const handleCopyWallet = async () => {
      if (!user?.walletAddress) return;
      await navigator.clipboard.writeText(user.walletAddress);
      setWalletCopied(true);
      setTimeout(() => setWalletCopied(false), 2000);
   };

   const truncateAddress = (addr: string) => {
      if (addr.length <= 12) return addr;
      return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
   };

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
                        maskImage: "url('/icons/arrow-left.svg')",
                     }}
                  />
               </button>
               <h1 className="text-md-h3 font-semibold text-md-heading">Account Settings</h1>
            </div>

            {/* Avatar + Name */}
            <div className="flex items-center gap-md-5 px-md-5 py-md-3">
               <div className="flex flex-col gap-md-1 items-center shrink-0">
                  <UserAvatar size={64} />
                  <button type="button" className="text-md-b1 text-md-primary-900">Change</button>
               </div>
               <div className="flex flex-col gap-md-1 flex-1 min-w-0">
                  <p className="text-md-b2 font-semibold text-md-heading">Display Name</p>
                  <div className="flex items-center justify-between bg-md-neutral-100 border border-md-neutral-600 rounded-md-input shadow-md-card px-md-3 py-md-2 overflow-hidden">
                     {isEditingName ? (
                        <input
                           type="text"
                           value={editName}
                           onChange={(e) => setEditName(e.target.value)}
                           autoFocus
                           className="flex-1 bg-transparent text-md-b1 text-md-neutral-1200 outline-none min-w-0"
                        />
                     ) : (
                        <span className="text-md-b1 text-md-neutral-1200 truncate">{currentDisplayName}</span>
                     )}
                     <button
                        type="button"
                        disabled={isSavingName}
                        onClick={() => {
                           if (isEditingName) {
                              handleSaveName();
                           } else {
                              setEditName(currentDisplayName);
                              setIsEditingName(true);
                           }
                        }}
                        className="text-md-b1 text-md-primary-900 shrink-0 ml-2"
                     >
                        {isSavingName ? '...' : isEditingName ? 'Save' : 'Edit'}
                     </button>
                  </div>
               </div>
            </div>

            {/* Sections */}
            <div className="flex flex-col gap-5 px-md-4">
               {/* Basic Information */}
               <div className="flex flex-col gap-3">
                  <h2 className="text-md-h5 font-semibold text-md-heading">Basic Information</h2>
                  <p className="text-md-b2 font-medium text-md-neutral-700">
                     Having an up-to-date email address attached to your account is a great step towards improving account security.
                  </p>
                  <ReadOnlyField
                     label="Email Address"
                     value={user?.email || ''}
                     actionLabel={isEmailPasswordUser ? 'Change' : undefined}
                     onAction={isEmailPasswordUser ? () => setShowEmailModal(true) : undefined}
                  />
                  <ReadOnlyField
                     label="Telegram"
                     value={user?.telegramUsername || 'Not Connected'}
                     actionLabel={!user?.telegramUsername ? 'Connect' : undefined}
                  />
                  <ReadOnlyField
                     label="Whatsapp"
                     value="Not Connected"
                     actionLabel="Connect"
                  />
               </div>

               {/* Security */}
               <div className="flex flex-col gap-3">
                  <h2 className="text-md-h5 font-semibold text-md-heading">Security</h2>
                  <p className="text-md-b2 font-medium text-md-neutral-700">
                     This information will be shown publicly so be careful what information you provide
                  </p>

                  {isEmailPasswordUser ? (
                     <ReadOnlyField
                        label="Password"
                        value="******"
                        actionLabel="Change"
                        onAction={() => setShowPasswordModal(true)}
                     />
                  ) : null}

                  {/* World ID */}
                  <div className="flex flex-col gap-md-1 w-full">
                     <p className="text-md-b2 font-semibold text-md-heading">World ID</p>
                     <div className="flex items-center gap-2 bg-md-neutral-100 border border-md-neutral-600 rounded-md-input shadow-md-card px-md-3 py-md-2 overflow-hidden">
                        {user?.isWorldId === 'ACTIVE' ? (
                           <>
                              <img src="/icons/check-fill.svg" alt="" className="w-4 h-4 shrink-0" />
                              <span className="text-md-b1 font-medium text-md-green-900">Verified Lender</span>
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
                              <span className="text-md-b1 text-md-neutral-1200 truncate">
                                 {connector?.name || truncateAddress(user?.walletAddress || '')}
                              </span>
                              <button type="button" onClick={handleCopyWallet} className="shrink-0 ml-2">
                                 <div
                                    className="w-5 h-5 bg-md-primary-900"
                                    style={{
                                       ...ICON_MASK,
                                       WebkitMaskImage: "url('/icons/copy.svg')",
                                       maskImage: "url('/icons/copy.svg')",
                                    }}
                                 />
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
                                 Connect
                              </button>
                           </>
                        )}
                     </div>
                     {walletCopied ? (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-md-heading text-md-neutral-100 text-md-b3 px-3 py-1 rounded-md-md whitespace-nowrap">
                           Wallet Address Copied
                        </div>
                     ) : null}
                  </div>

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

               {/* Notifications */}
               <div className="flex flex-col gap-3">
                  <h2 className="text-md-h5 font-semibold text-md-heading">Notifications</h2>
                  <p className="text-md-b2 font-medium text-md-neutral-700">
                     Get notified of activity going on with your account. Notifications will be sent to the email that you have provided.
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
                        <p className="text-md-b3 font-medium text-md-neutral-1400">
                           Get important notifications about your transactions
                        </p>
                     </div>

                     {/* Moodeng Blogs */}
                     <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                           <p className="text-md-b2 font-semibold text-md-heading">Moodeng Blogs</p>
                           <Toggle checked={notifPrefs.moodengBlogs} onChange={() => toggleNotif('moodengBlogs')} />
                        </div>
                        <p className="text-md-b3 font-medium text-md-neutral-1400">
                           Get updated with our latest news, updates and blogs
                        </p>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
         <ChangeEmailModal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} />
      </div>
   );
}
