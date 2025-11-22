import type { ChangeEvent } from 'react';

import FormField from '@/components/forms/FormField';

interface ProfileSettingsProps {
   username: string;
   email: string;
   telegramUsername: string;
   currentUsername?: string;
   currentEmail?: string;
   currentTelegramUsername?: string;
   onUsernameChange: (value: string) => void;
   onEmailChange: (value: string) => void;
   onTelegramChange: (value: string) => void;
   onUpdate: () => void;
   isSendingTestEmail: boolean;
   onTestEmail: () => void;
}

export default function ProfileSettings({
   username,
   email,
   telegramUsername,
   currentUsername,
   currentEmail,
   currentTelegramUsername,
   onUsernameChange,
   onEmailChange,
   onTelegramChange,
   onUpdate,
   isSendingTestEmail,
   onTestEmail
}: ProfileSettingsProps) {
   const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

   return (
      <form className="flex flex-col md:flex-row gap-8">
         <div className="flex flex-col gap-16 w-full md:w-1/3 text-[10px] text-[#4a4a4a] font-normal leading-[12px]">
            <section>
               <h2 className="font-semibold text-[12px] text-[#0a1a5f] mb-2 select-none">Profile</h2>
               <p className="mb-1">
                  Having an up-to-date email address attached to your account is a great step towards improving account security.
               </p>
               <p>You can also opt to receive notifications via Telegram or WhatsApp to stay informed of any account changes.</p>
            </section>
         </div>
         <div className="flex flex-col w-full md:w-2/3 space-y-6 text-[10px] text-[#4a4a4a] font-normal leading-[12px]">
            <FormField
               id="username"
               label="Username"
               value={username}
               onChange={onUsernameChange}
               placeholder={currentUsername || ''}
               actionButton={{
                  label: 'Change Username',
                  onClick: onUpdate
               }}
            />
            <FormField
               id="email"
               label="Email"
               type="email"
               value={email}
               onChange={onEmailChange}
               placeholder={currentEmail || ''}
               actionButton={{
                  label: 'Change Email',
                  onClick: onUpdate
               }}
            />
            {isDevMode ? (
               <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-3">
                     <label className="text-[#0a1a5f] font-semibold text-[10px] leading-[12px] select-none block">Test Email</label>
                     <p className="text-[8px] text-[#4a4a4a] font-normal leading-[10px] mt-1">
                        Send a test email to verify your email configuration
                     </p>
                  </div>
                  <div className="col-span-6 flex items-center">
                     <p className="text-[8px] text-[#4a4a4a] font-normal leading-[10px]">
                        Development mode only: Send a test email to {currentEmail}
                     </p>
                  </div>
                  <div className="col-span-3">
                     <button
                        type="button"
                        onClick={onTestEmail}
                        disabled={isSendingTestEmail}
                        className="bg-[#4caf50] text-white rounded px-3 py-1 text-[10px] font-semibold leading-[12px] w-full hover:bg-[#3a9d3a] transition disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                        {isSendingTestEmail ? 'Sending...' : 'Send Test Email'}
                     </button>
                  </div>
               </div>
            ) : null}
            <div className="grid grid-cols-12 items-center gap-3">
               <div className="col-span-3">
                  <label className="text-[#0a1a5f] font-semibold text-[10px] leading-[12px] select-none block">Telegram</label>
                  <p className="text-[8px] text-[#4a4a4a] font-normal leading-[10px] mt-1">
                     Connect your telegram to get the latest updates
                  </p>
               </div>
               <input
                  id="telegram"
                  type="text"
                  placeholder={currentTelegramUsername || ''}
                  value={telegramUsername}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => onTelegramChange(e.target.value)}
                  className="col-span-6 bg-[#e0e7ff] rounded px-2 py-1 text-[#3b82f6] text-[10px] font-normal leading-[12px] outline-none"
               />
               <button
                  type="button"
                  onClick={onUpdate}
                  className="col-span-3 bg-[#1e40af] text-white rounded px-3 py-1 text-[10px] font-semibold leading-[12px] hover:bg-[#1e3a8a] transition"
               >
                  {currentTelegramUsername ? 'Update' : 'Connect'}
               </button>
            </div>
            <div className="grid grid-cols-12 gap-3">
               <div className="col-span-3">
                  <label className="text-[#0a1a5f] font-semibold text-[10px] leading-[12px] select-none block">Whatsapp</label>
                  <p className="text-[8px] text-[#4a4a4a] font-normal leading-[10px] mt-1">
                     Connect your WhatsApp to get the latest updates
                  </p>
               </div>
               <div className="col-span-6">
                  <button
                     type="button"
                     className="bg-[#1e40af] text-white rounded px-3 py-1 text-[10px] font-semibold leading-[12px] w-full hover:bg-[#1e3a8a] transition"
                  >
                     Connect Account
                  </button>
               </div>
            </div>
         </div>
      </form>
   );
}
