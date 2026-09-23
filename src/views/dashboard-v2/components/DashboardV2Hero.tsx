import { useState } from 'react';

import clsx from 'clsx';
import { Link } from 'react-router-dom';

import UserAvatar from '@/components/UserAvatar';
import { DASHBOARD_V2_ASSETS, getMoodengAsset, getTierTrackAsset } from '@/views/dashboard-v2/assets';
import DesignImage from '@/views/dashboard-v2/components/DesignImage';
import { MOODENG_TIERS } from '@/views/dashboard-v2/dashboardV2Model';
import type { DashboardV2Model, MoodengMood } from '@/views/dashboard-v2/types';

interface DashboardV2HeroProps {
   model: DashboardV2Model;
   /** Sample states have no signed-in user, so they fall back to the design's placeholder avatar. */
   showRealAvatar: boolean;
}

// The hero is one illustrated scene, so it keeps the Figma frame's vertical positions (minus the
// 54px iOS status bar) and converts horizontal ones to percentages of the 440px frame.
const CHARACTER_TOP: Record<MoodengMood, number> = { waiting: 117, loan: 98, repaid: 109 };

const TIER_LABEL_LAYOUT = [
   { left: '7.5%', width: 72, top: 284 },
   { left: '28.64%', width: 87, top: 294 },
   { left: '50.9%', width: 91, top: 294 },
   { left: '73.86%', width: 91, top: 284 }
];

const PROGRESS_TRACK_INNER_WIDTH = 394;
const PROGRESS_MIN_WIDTH = 13;

export default function DashboardV2Hero({ model, showRealAvatar }: DashboardV2HeroProps) {
   const currentTierIndex = Math.max(
      MOODENG_TIERS.findIndex((tier) => tier.id === model.tier),
      0
   );
   const [browsedTierIndex, setBrowsedTierIndex] = useState(currentTierIndex);
   const [isTrustTipOpen, setIsTrustTipOpen] = useState(!model.isVerified);
   const [isCreditTipOpen, setIsCreditTipOpen] = useState(model.creditLevel === 0);
   const browsedTier = MOODENG_TIERS[browsedTierIndex] ?? MOODENG_TIERS[0];
   const fillWidth = Math.max(PROGRESS_MIN_WIDTH, Math.round(model.creditProgress * PROGRESS_TRACK_INNER_WIDTH));

   return (
      <section className="relative h-[408px] w-full" aria-label="Your Moodeng">
         <div className="absolute inset-x-0 top-0 h-[360px] overflow-hidden">
            <DesignImage src={DASHBOARD_V2_ASSETS.heroBackground} className="absolute left-0 top-[-54px] h-[414px] w-full object-cover" />
         </div>
         <DesignImage src={DASHBOARD_V2_ASSETS.sheetTop} className="absolute left-0 top-[338px] h-auto w-full" />

         {/* Greeting */}
         <div className="absolute left-5 top-5 flex items-center gap-2.5">
            <div className="flex w-[73px] flex-col items-center">
               {showRealAvatar ? (
                  <UserAvatar size={63} alt={model.firstName} clickable={false} className="-mb-3.5" />
               ) : (
                  <span className="-mb-3.5 block h-[63px] w-[63px] rounded-full bg-[#c9bfe6]" aria-hidden="true" />
               )}
               <span className="relative flex h-5 w-full items-center justify-center gap-0.5 rounded-full border-[0.675px] border-[#c0b9c8] bg-[#efedf1] text-[14px] font-medium leading-none tracking-[-0.84px] text-[#7b6b8c]">
                  {model.isVerified ? <DesignImage src={DASHBOARD_V2_ASSETS.verified} className="h-3.5 w-3.5" /> : null}
                  {model.isVerified ? 'Verified' : 'Unverified'}
               </span>
            </div>
            <div className="flex flex-col">
               <p className="text-[22px] font-semibold leading-[1.2] text-[#1c053d]">Hi {model.firstName}!</p>
               <p className="text-[16px] leading-[18px] text-[#594d65]">
                  Live for {model.daysLive} {model.daysLive === 1 ? 'day' : 'days'}
               </p>
            </div>
         </div>

         {/* Help + Home */}
         <div className="absolute right-0 top-7 flex items-center gap-[11px]">
            <Link to="/help" className="flex w-[38px] flex-col items-center">
               <DesignImage src={DASHBOARD_V2_ASSETS.help} className="-mb-1 h-7 w-7" />
               <span className="text-[14px] leading-[18px] tracking-[-0.56px] text-[#594d65]">Help</span>
            </Link>
            <Link
               to="/"
               className="flex h-12 w-[72px] items-start rounded-l-[27px] bg-[rgba(137,153,163,0.62)] py-[3px] pl-3.5 pr-5"
            >
               <span className="flex w-[38px] flex-col items-center">
                  <DesignImage src={DASHBOARD_V2_ASSETS.home} className="-mb-1 h-7 w-7" />
                  <span className="text-[14px] leading-[18px] tracking-[-0.56px] text-white">Home</span>
               </span>
            </Link>
         </div>

         {/* Trust tip bubble */}
         {isTrustTipOpen ? (
            <div className="absolute left-[calc(50%-75px)] top-[77px] w-[168px]">
               <div className="relative mt-2.5 rounded-[10px] bg-[#fffef7]/80 px-[7px] py-[6px]">
                  <p className="text-[14px] font-medium leading-[14px] text-[#7b6b8c]">Grow your Trust with on-time micro-loans.</p>
                  <span className="absolute -bottom-2 left-[18px] h-0 w-0 border-x-[7px] border-t-[8px] border-x-transparent border-t-[#fffef7]/80" />
               </div>
               <button
                  type="button"
                  onClick={() => setIsTrustTipOpen(false)}
                  className="absolute right-0 top-0 h-5 w-5"
                  aria-label="Dismiss tip"
               >
                  <DesignImage src={DASHBOARD_V2_ASSETS.close} className="h-5 w-5" />
               </button>
            </div>
         ) : null}

         {/* Moodeng + tier browsing */}
         <DesignImage
            src={getMoodengAsset(browsedTier.id, model.mood)}
            alt={`${browsedTier.label} Moodeng`}
            className="absolute left-1/2 h-[164px] w-[164px] -translate-x-1/2"
            style={{ top: CHARACTER_TOP[model.mood] }}
         />
         <button
            type="button"
            onClick={() => setBrowsedTierIndex((index) => Math.max(index - 1, 0))}
            disabled={browsedTierIndex === 0}
            className="absolute left-0 top-[163px] h-20 w-20 disabled:opacity-40"
            aria-label="Previous Moodeng tier"
         >
            <DesignImage src={DASHBOARD_V2_ASSETS.arrowLeft} className="h-20 w-20" />
         </button>
         <button
            type="button"
            onClick={() => setBrowsedTierIndex((index) => Math.min(index + 1, MOODENG_TIERS.length - 1))}
            disabled={browsedTierIndex === MOODENG_TIERS.length - 1}
            className="absolute right-0 top-[163px] h-20 w-20 disabled:opacity-40"
            aria-label="Next Moodeng tier"
         >
            <DesignImage src={DASHBOARD_V2_ASSETS.arrowRight} className="h-20 w-20" />
         </button>

         {/* Tier track */}
         <DesignImage src={getTierTrackAsset(model.tier)} className="absolute left-0 top-[260px] h-7 w-full" />
         {MOODENG_TIERS.map((tier, index) => {
            const layout = TIER_LABEL_LAYOUT[index];
            const isCurrent = index === currentTierIndex;
            return (
               <div
                  key={tier.id}
                  className={clsx('absolute flex flex-col items-center text-center italic', isCurrent ? 'text-[#303520]' : 'text-[#516024]')}
                  style={{ left: layout.left, top: layout.top, width: layout.width }}
               >
                  <span className="text-[16px] font-black leading-[10px]">{tier.label}</span>
                  <span className="whitespace-nowrap text-[14px] font-semibold leading-[18px]">
                     {isCurrent ? model.pandesal : tier.minPandesal}pandesal
                  </span>
               </div>
            );
         })}

         {/* Credit level */}
         <div className="absolute inset-x-5 top-[347px] flex items-end justify-between">
            <div className="flex items-baseline gap-0.5">
               <span className="text-[34px] font-black italic leading-[1.2] tracking-[-0.68px] text-[#735dfa]">LV{model.creditLevel}</span>
               <span className="bg-gradient-to-r from-[#c3bbce] to-[#a78acf] bg-clip-text text-[20px] font-semibold leading-9 text-transparent">
                  Credit Level
               </span>
               <button
                  type="button"
                  onClick={() => setIsCreditTipOpen((isOpen) => !isOpen)}
                  className="ml-0.5 h-3.5 w-3.5 self-center"
                  aria-label="About credit level"
                  aria-expanded={isCreditTipOpen}
               >
                  <DesignImage src={DASHBOARD_V2_ASSETS.info} className="h-3.5 w-3.5" />
               </button>
            </div>
            <p className="pb-2 text-right text-[20px] font-medium leading-4 tracking-[0.4px]">
               <span className="text-[#4f36ef]">{model.creditHint.highlight}</span>
               <span className="text-[#c0b9c8]">{model.creditHint.rest}</span>
            </p>
         </div>
         <div
            className="absolute inset-x-5 top-[391px] h-[17px] rounded-full border-[3px] border-white bg-[#eee]"
            role="progressbar"
            aria-label="Progress to next credit level"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(model.creditProgress * 100)}
         >
            <div
               className="h-[11px] max-w-full rounded-full bg-gradient-to-r from-[#ebddff] to-[#4f36f0] transition-[width] duration-500"
               style={{ width: fillWidth }}
            />
         </div>
         {isCreditTipOpen ? (
            <div className="absolute left-[calc(50%-43px)] top-[384px] z-10 w-[167px]" role="tooltip">
               <span className="absolute left-[17px] top-0 h-0 w-0 border-x-[7px] border-b-[8px] border-x-transparent border-b-[#34268e]/80" />
               <p className="mt-1.5 rounded-[10px] bg-[#34268e]/80 px-[7px] py-[6px] text-[14px] font-medium leading-[14px] text-white">
                  Unlock higher limits by repaying on time.
               </p>
            </div>
         ) : null}
      </section>
   );
}
