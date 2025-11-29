import { ConnectButton } from '@rainbow-me/rainbowkit';

import FormField from '@/components/forms/FormField';
import WorldIDVerificationStatus from '@/components/worldId/WorldIDVerificationStatus';

interface SecuritySettingsProps {
   password: string;
   walletAddress?: string;
   onPasswordChange: (value: string) => void;
   onUpdate: () => void;
}

export default function SecuritySettings({ password, walletAddress, onPasswordChange, onUpdate }: SecuritySettingsProps) {
   return (
      <form className="flex flex-col md:flex-row gap-8">
         <div className="flex flex-col gap-16 w-full md:w-1/3 text-[10px] text-[#4a4a4a] font-normal leading-[12px]">
            <section>
               <h2 className="font-semibold text-[12px] text-[#0a1a5f] mb-2 select-none">Security</h2>
               <p>This information will be shown publicly so be careful what information you provide</p>
            </section>
         </div>
         <div className="flex flex-col w-full md:w-2/3 space-y-6 text-[10px] text-[#4a4a4a] font-normal leading-[12px]">
            <FormField
               id="password"
               label="Password"
               type="password"
               value={password}
               onChange={onPasswordChange}
               placeholder="New Password"
               actionButton={{
                  label: 'Change Password',
                  onClick: onUpdate
               }}
            />
            <div className="grid grid-cols-12 items-center gap-3">
               <label htmlFor="wallet" className="col-span-3 text-[#0a1a5f] font-semibold text-[10px] leading-[12px] select-none">
                  Wallet
               </label>
               <input
                  id="wallet"
                  type="text"
                  value={walletAddress || ''}
                  placeholder={walletAddress || ''}
                  disabled
                  className="col-span-6 bg-[#e0e7ff] rounded px-2 py-1 text-[#4a4a4a] text-[10px] font-normal leading-[12px] outline-none"
               />
            </div>
            <ConnectButton />
            <WorldIDVerificationStatus />
         </div>
      </form>
   );
}
