import { useNavigate } from 'react-router-dom';

import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';

const TELEGRAM_URL =
   'https://t.me/jimmymoodengcredit?text=Hello%2C%20I%27m%20Jimmy%2C%20co-founder%20of%20Moodeng%20Credit.%20Happy%20to%20help%20you.%20If%20English%20isn%27t%20your%20first%20language%2C%20just%20tell%20me%20and%20we%20can%20use%20Google%20Translate.%20Anything%20you%20need%20to%20know%20about%20the%20platform%20or%20how%20to%20use%20it%2C%20I%20can%20support%20you';

const FACEBOOK_PAGE_URL = 'https://www.facebook.com/profile.php?id=61589106561061';
const FACEBOOK_COMMUNITY_URL = 'https://www.facebook.com/groups/1593629908540434';

interface ActionRowProps {
   icon: React.ReactNode;
   title: string;
   subtitle: string;
   onClick: () => void;
   noBorder?: boolean;
}

function ActionRow({ icon, title, subtitle, onClick, noBorder }: ActionRowProps) {
   return (
      <button
         type="button"
         onClick={onClick}
         className={`w-full flex gap-[10px] items-center py-md-3 text-left ${!noBorder ? 'border-b border-md-neutral-600' : ''}`}
      >
         <div className="flex flex-1 gap-[10px] h-[52px] items-center min-w-0">
            {icon}
            <div className="flex flex-col flex-1 items-start justify-center min-w-0">
               <p className="text-[16px] font-[510] leading-[24px] tracking-[-0.32px] text-[#0f172b]">{title}</p>
               <p className="text-[12px] font-bold leading-[18px] tracking-[-0.24px] text-[#45556c]">{subtitle}</p>
            </div>
         </div>
         <span
            className="block size-6 flex-shrink-0 bg-md-neutral-600"
            style={{
               WebkitMaskImage: "url('/icons/chevron-right.svg')",
               maskImage: "url('/icons/chevron-right.svg')",
               WebkitMaskRepeat: 'no-repeat',
               maskRepeat: 'no-repeat',
               WebkitMaskPosition: 'center',
               maskPosition: 'center',
               WebkitMaskSize: 'contain',
               maskSize: 'contain',
            }}
         />
      </button>
   );
}

function IconBadge({ color, iconPath, rounded }: { color: string; iconPath: string; rounded?: boolean }) {
   return (
      <div
         className={`size-[32px] flex items-center justify-center flex-shrink-0 ${rounded ? 'rounded-full' : 'rounded-[10px]'}`}
         style={{ background: color }}
      >
         <span
            className="block size-[20px] bg-white"
            style={{
               WebkitMaskImage: `url('${iconPath}')`,
               maskImage: `url('${iconPath}')`,
               WebkitMaskSize: 'contain',
               maskSize: 'contain',
               WebkitMaskRepeat: 'no-repeat',
               maskRepeat: 'no-repeat',
               WebkitMaskPosition: 'center',
               maskPosition: 'center',
            }}
         />
      </div>
   );
}

export default function Congratulations() {
   const navigate = useNavigate();
   const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white flex flex-col max-w-[440px] mx-auto w-full">
         <OnboardingHeader hideBack />

         <div className="flex flex-col flex-1 gap-[20px] p-[20px]">

            {/* Party hippo — export from Figma node 2379:8824 → /public/hippos/party.png. Falls back to thumb-up-right.png until then. */}
            <img
               src="/hippos/party.png"
               alt="Moodeng celebrating"
               className="w-[110px] h-[96px] object-cover"
               onError={(e) => { (e.target as HTMLImageElement).src = '/hippos/thumb-up-right.png'; }}
            />

            {/* Heading */}
            <div className="flex flex-col gap-[4px]">
               <h1 className="text-[34px] font-[590] leading-[1.2] tracking-[-1.36px] text-[#040033]">
                  Congratulations! 🎉
               </h1>
               <p className="text-[16px] font-[510] leading-[24px] tracking-[-0.32px] text-[#45556c]">
                  Your Moodeng account is fully set up and you&rsquo;re ready to go!
               </p>
            </div>

            {/* What's Next */}
            <div className="flex flex-col gap-[4px]">
               <h2 className="text-[18px] font-[590] leading-[1.2] tracking-[-0.72px] text-[#0a0a0a]">
                  What&rsquo;s Next?
               </h2>
               <div className="flex flex-col">
                  <ActionRow
                     icon={<IconBadge color="#155dfc" iconPath="/icons/book-open.svg" />}
                     title="Browse Guides"
                     subtitle="Quick Start for New Users"
                     onClick={() => navigate('/support/guides')}
                  />
                  <ActionRow
                     icon={<IconBadge color="linear-gradient(180deg, #2aabee 0%, #229ed9 100%)" iconPath="/icons/send.svg" rounded />}
                     title="Get Help via Telegram"
                     subtitle="Message us for wallet help, deposits, or questions"
                     onClick={() => openExternal(TELEGRAM_URL)}
                  />
                  <ActionRow
                     icon={<IconBadge color="#1877f2" iconPath="/icons/facebook.svg" />}
                     title="Contact Us on Facebook"
                     subtitle="Join our community and ask questions"
                     onClick={() => openExternal(FACEBOOK_PAGE_URL)}
                  />
                  <ActionRow
                     noBorder
                     icon={<IconBadge color="#9810fa" iconPath="/icons/trend-up.svg" />}
                     title="Learn Credit Leveling System"
                     subtitle="Grow Limits, Build Trust"
                     onClick={() => navigate('/support/getting-started')}
                  />
               </div>
            </div>

            {/* Explore CTA */}
            <div className="flex flex-col gap-[8px]">
               <button
                  type="button"
                  onClick={() => navigate('/request-board')}
                  className="flex items-center justify-center gap-[8px] w-full px-[20px] py-[16px] rounded-[16px] bg-[#6010d2] text-[16px] font-[590] leading-[24px] tracking-[-0.32px] text-[#fdfcfd]"
               >
                  Explore the Request Board
                  <span
                     className="block size-6 bg-white flex-shrink-0"
                     style={{
                        WebkitMaskImage: "url('/icons/chevron-right.svg')",
                        maskImage: "url('/icons/chevron-right.svg')",
                        WebkitMaskRepeat: 'no-repeat',
                        maskRepeat: 'no-repeat',
                        WebkitMaskPosition: 'center',
                        maskPosition: 'center',
                        WebkitMaskSize: 'contain',
                        maskSize: 'contain',
                     }}
                  />
               </button>
               <p className="text-[12px] font-bold leading-[18px] tracking-[-0.24px] text-[#62748e] text-center">
                  You can now explore Moodeng Credit and begin your journey with confidence.
               </p>
            </div>

            {/* Voices Against Unfair Loans card */}
            <div className="flex gap-[12px] items-start rounded-[16px] border border-md-neutral-600 bg-md-neutral-300 overflow-hidden">
               <img
                  src="/hippos/community.png"
                  alt="Moodeng community hippo"
                  className="w-[136px] h-[120px] object-bottom flex-shrink-0"
               />
               <div className="flex flex-col gap-[8px] items-start p-[16px] flex-1 min-w-0">
                  <div className="flex flex-col">
                     <p className="text-[16px] font-[510] leading-[24px] tracking-[-0.32px] text-[#0f172b]">
                        Voices Against Unfair Loans
                     </p>
                     <p className="text-[12px] font-bold leading-[18px] tracking-[-0.24px] text-[#45556c]">
                        Join Our Facebook Community. Connect with other Moodeng Credit users.
                     </p>
                  </div>
                  <button
                     type="button"
                     onClick={() => openExternal(FACEBOOK_COMMUNITY_URL)}
                     className="flex items-center gap-[4px] px-[12px] py-[8px] rounded-[12px] border border-[#6010d2] text-[14px] font-[590] leading-[21px] tracking-[-0.28px] text-[#6010d2] whitespace-nowrap"
                  >
                     Join Our Community
                     <span
                        className="block size-[18px] bg-[#6010d2] flex-shrink-0"
                        style={{
                           WebkitMaskImage: "url('/icons/view_link.svg')",
                           maskImage: "url('/icons/view_link.svg')",
                           WebkitMaskSize: 'contain',
                           maskSize: 'contain',
                           WebkitMaskRepeat: 'no-repeat',
                           maskRepeat: 'no-repeat',
                           WebkitMaskPosition: 'center',
                           maskPosition: 'center',
                        }}
                     />
                  </button>
               </div>
            </div>

         </div>
      </div>
   );
}
