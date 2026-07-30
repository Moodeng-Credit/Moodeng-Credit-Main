import { Bell, ShieldCheck, User, WalletCards } from 'lucide-react';

import { SettingsGroup, SettingsRow } from '@/views/account/AccountSettings';

// DEV-only harness so the Account Settings card/row styling can be reviewed and screenshotted
// without a logged-in account (AccountSettings itself reads live Redux/auth state). Mounted at
// /account-settings-preview in dev only. No effect in prod.
export default function SettingsStylePreview() {
   const noop = () => {};
   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="mx-auto flex max-w-[440px] flex-col gap-6 px-md-4 py-md-5">
            <h1 className="text-md-h6 font-semibold text-md-heading">Account settings</h1>

            <SettingsGroup label="Account">
               <SettingsRow
                  title="Personal details"
                  summary="Jamie Cruz · jamie@example.com"
                  icon={<User size={19} strokeWidth={1.8} />}
                  onClick={noop}
               />
               <SettingsRow
                  title="Security & verification"
                  summary="Identity verified"
                  icon={<ShieldCheck size={19} strokeWidth={1.8} />}
                  onClick={noop}
               />
            </SettingsGroup>

            <SettingsGroup label="Money">
               <SettingsRow
                  title="Wallet"
                  summary="Base Account · 0x95B6…d431"
                  icon={<WalletCards size={19} strokeWidth={1.8} />}
                  onClick={noop}
               />
            </SettingsGroup>

            <SettingsGroup label="Notifications">
               <SettingsRow
                  title="Notifications"
                  summary="2 of 3 preferences enabled"
                  icon={<Bell size={19} strokeWidth={1.8} />}
                  onClick={noop}
               />
            </SettingsGroup>
         </div>
      </div>
   );
}
