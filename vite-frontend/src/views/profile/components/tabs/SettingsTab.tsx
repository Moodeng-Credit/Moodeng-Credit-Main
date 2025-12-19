import { NotificationSettings, ProfileSettings, SecuritySettings } from '@/views/profile/components/settings';

interface SettingsTabProps {
   username: string;
   email: string;
   telegramUsername: string;
   password: string;
   currentUsername?: string;
   currentEmail?: string;
   currentTelegramUsername?: string;
   walletAddress?: string;
   onUsernameChange: (value: string) => void;
   onEmailChange: (value: string) => void;
   onTelegramChange: (value: string) => void;
   onPasswordChange: (value: string) => void;
   onUpdate: () => void;
   onRevert: () => void;
   isSendingTestEmail: boolean;
   onTestEmail: () => void;
}

export default function SettingsTab({
   username,
   email,
   telegramUsername,
   password,
   currentUsername,
   currentEmail,
   currentTelegramUsername,
   walletAddress,
   onUsernameChange,
   onEmailChange,
   onTelegramChange,
   onPasswordChange,
   onUpdate,
   onRevert,
   isSendingTestEmail,
   onTestEmail
}: SettingsTabProps) {
   return (
      <div className="flex items-center justify-center p-6">
         <main className="bg-white rounded-md w-full max-w-5xl p-8 relative grid gap-8 z-[0]">
            <div className="absolute -top-5 left-0 bg-white rounded-md px-4 py-2">
               <h1 className="text-[#0a1a5f] font-semibold text-base leading-5 select-none">Account Settings</h1>
            </div>
            <div className="flex justify-end gap-3">
               <button
                  type="button"
                  onClick={onRevert}
                  className="text-[#f44336] border border-[#f44336] rounded px-3 py-1 text-[10px] font-normal leading-[12px] hover:bg-[#f44336] hover:text-white transition"
               >
                  Revert Changes
               </button>
               <button
                  type="submit"
                  onClick={onUpdate}
                  className="bg-[#1e40af] text-white rounded px-4 py-1 text-[10px] font-semibold leading-[12px] hover:bg-[#1e3a8a] transition"
               >
                  Save Changes
               </button>
            </div>
            <ProfileSettings
               username={username}
               email={email}
               telegramUsername={telegramUsername}
               currentUsername={currentUsername}
               currentEmail={currentEmail}
               currentTelegramUsername={currentTelegramUsername}
               onUsernameChange={onUsernameChange}
               onEmailChange={onEmailChange}
               onTelegramChange={onTelegramChange}
               onUpdate={onUpdate}
               isSendingTestEmail={isSendingTestEmail}
               onTestEmail={onTestEmail}
            />
            <SecuritySettings password={password} walletAddress={walletAddress} onPasswordChange={onPasswordChange} onUpdate={onUpdate} />
            <NotificationSettings />
         </main>
      </div>
   );
}
