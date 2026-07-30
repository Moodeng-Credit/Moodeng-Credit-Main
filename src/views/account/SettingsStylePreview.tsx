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

            {/* Detail-page card treatment (Profile photo card + a Connected-wallet row),
                mirroring the swept inline cards inside the real detail sub-pages. */}
            <p className="mt-2 px-1 text-md-b3 font-semibold uppercase tracking-[0.08em] text-md-primary-1200">
               Detail-page cards
            </p>
            <div className="mb-1 flex items-center gap-md-2 rounded-md-lg border border-md-primary-300 bg-md-neutral-100 p-md-3 shadow-md-card">
               <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-md-primary-100 text-md-primary-1200">
                  <User size={22} strokeWidth={1.8} />
               </span>
               <div className="min-w-0 flex-1">
                  <p className="text-md-b2 font-semibold text-md-heading">Profile photo</p>
                  <p className="text-md-b2 font-medium text-md-neutral-1200">Helps people recognize you</p>
               </div>
            </div>
            <div className="overflow-hidden rounded-md-lg border border-md-primary-300 bg-md-neutral-100 shadow-md-card">
               <div className="flex min-h-[72px] items-center gap-md-2 px-md-3 py-md-2">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md-input bg-md-primary-100 text-md-primary-1200">
                     <WalletCards size={20} strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                     <p className="text-md-b1 font-semibold text-md-heading">Base Account</p>
                     <p className="text-md-b2 font-medium text-md-neutral-1200">0x95B6…d431</p>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
