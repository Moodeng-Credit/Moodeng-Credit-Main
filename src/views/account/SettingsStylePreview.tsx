import { User } from 'lucide-react';

import { SettingsFieldRow, SettingsGroup, SettingsRow, Toggle } from '@/views/account/AccountSettings';

// DEV-only harness so the Account Settings card/row styling can be reviewed and screenshotted
// without a logged-in account (AccountSettings itself reads live Redux/auth state). Mounted at
// /account-settings-preview in dev only. No effect in prod.
export default function SettingsStylePreview() {
   const noop = () => {};
   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="mx-auto flex max-w-[440px] flex-col gap-6 px-md-4 py-md-5">
            <h1 className="text-md-h3 font-semibold text-md-heading">Account settings</h1>

            <SettingsGroup label="Account">
               <SettingsRow
                  title="Personal details"
                  summary="Jamie Cruz · jamie@example.com"
                  icon={<img src="/icons/personal-details-card-3d.png" alt="" className="size-7 object-contain" />}
                  onClick={noop}
               />
               <SettingsRow
                  title="Security & verification"
                  summary="Identity verified"
                  icon={<img src="/icons/security-lock-3d.png" alt="" className="size-7 object-contain" />}
                  onClick={noop}
               />
            </SettingsGroup>

            <SettingsGroup label="Money">
               <SettingsRow
                  title="Wallet"
                  summary="Base Account · 0x95B6…d431"
                  icon={<img src="/icons/base-account.svg" alt="" className="size-9 rounded-md-md" />}
                  onClick={noop}
               />
            </SettingsGroup>

            <SettingsGroup
               label="Notifications"
               description="Get notified of activity going on with your account. Notifications will be sent to the email that you have provided."
            >
               <SettingsRow
                  title="Notifications"
                  summary="2 of 3 preferences enabled"
                  icon={<img src="/icons/notification-bell-3d.png" alt="" className="size-7 object-contain" />}
                  onClick={noop}
               />
               {/* Both toggle states side by side so the Figma inverted-knob
                   treatment can be eyeballed in one screenshot. */}
               <div className="flex flex-col gap-md-2 px-md-3 py-md-2">
                  <div className="flex items-center justify-between gap-md-2">
                     <div className="min-w-0">
                        <p className="text-md-b2 font-semibold text-md-heading">Account Activity</p>
                        <p className="text-md-b3 font-medium text-md-neutral-1400">
                           Get important notifications about you or activity you&rsquo;ve missed
                        </p>
                     </div>
                     <Toggle checked onChange={noop} label="Account activity (on)" />
                  </div>
                  <div className="flex items-center justify-between gap-md-2">
                     <div className="min-w-0">
                        <p className="text-md-b2 font-semibold text-md-heading">Moodeng Blogs</p>
                        <p className="text-md-b3 font-medium text-md-neutral-1400">
                           Get updated with our latest news, updates and blogs
                        </p>
                     </div>
                     <Toggle checked={false} onChange={noop} label="Moodeng blogs (off)" />
                  </div>
               </div>
            </SettingsGroup>

            {/* A detail sub-page ("Personal details"), grouped into labeled card
                sections like the Wallet page — the structure the real sub-pages use. */}
            <p className="mt-4 px-1 text-md-h3 font-semibold text-md-heading">Personal details</p>
            <p className="-mt-4 px-1 text-md-b2 font-medium leading-5 text-md-neutral-1200">
               Keep your profile and contact details up to date.
            </p>
            <SettingsGroup label="Profile">
               <SettingsFieldRow
                  leading={
                     <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-md-primary-100 text-md-primary-1200">
                        <User size={20} strokeWidth={1.8} />
                     </span>
                  }
                  title="Profile photo"
                  value="Helps people recognize you"
                  actionLabel="Change"
                  onAction={noop}
               />
               <SettingsFieldRow title="Display name" value="Jamie Cruz" actionLabel="Change" onAction={noop} />
            </SettingsGroup>
            <SettingsGroup label="Contact" description="Used for account recovery and important alerts.">
               <SettingsFieldRow title="Email address" value="jamie@example.com" actionLabel="Change" onAction={noop} />
            </SettingsGroup>
            <SettingsGroup label="About you">
               <SettingsFieldRow
                  title="Bio"
                  value="Work, income, and what you need help with"
                  actionLabel="Change"
                  onAction={noop}
               />
            </SettingsGroup>
         </div>
      </div>
   );
}
