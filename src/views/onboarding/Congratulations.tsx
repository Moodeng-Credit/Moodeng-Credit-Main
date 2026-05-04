import { useNavigate } from 'react-router-dom';

import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';

const TELEGRAM_URL =
   'https://t.me/jimmymoodengcredit?text=Hi%2C%20I%20found%20you%20through%20Moodeng%20Credit%20and%20I%27d%20like%20to%20learn%20more.';

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
         className={`flex w-full items-center gap-[10px] py-3 text-left active:scale-[0.99] ${!noBorder ? 'border-b border-md-neutral-600' : ''}`}
      >
         <div className="flex min-w-0 flex-1 items-center gap-[10px]">
            {icon}
            <div className="flex min-w-0 flex-1 flex-col justify-center">
               <p className="truncate text-[16px] font-[510] leading-6 tracking-[-0.02em] text-[#0f172b]">{title}</p>
               <p className="truncate text-[12px] font-normal leading-[18px] tracking-[-0.02em] text-[#45556c]">{subtitle}</p>
            </div>
         </div>
         <span
            className="block size-6 shrink-0 bg-md-primary-2000"
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

function ImageIconBadge({ src }: { src: string }) {
   return <img src={src} alt="" className="size-8 shrink-0" />;
}

export default function Congratulations() {
   const navigate = useNavigate();
   const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

   return (
      <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col overflow-hidden rounded-[20px] bg-gradient-to-b from-[#fbfafd] to-white">
         <OnboardingHeader title="Verify World ID" />

         <main className="flex flex-1 flex-col gap-5 px-5 pb-5 pt-3">
            <img src="/hippos/party.png" alt="Moodeng celebrating" className="h-24 w-[110px] object-contain" />

            <div className="flex flex-col gap-1">
               <h1 className="text-[34px] font-[590] leading-[1.2] tracking-[-0.04em] text-[#040033]">Congratulations! 🎉</h1>
               <p className="text-[16px] font-[510] leading-6 tracking-[-0.02em] text-[#45556c]">
                  Your Moodeng account is fully set up and you&rsquo;re ready to go!
               </p>
            </div>

            <section className="flex flex-col gap-1">
               <h2 className="text-[18px] font-[590] leading-[1.2] tracking-[-0.04em] text-[#0a0a0a]">What&apos;s Next?</h2>
               <div className="flex flex-col">
                  <ActionRow
                     icon={<IconBadge color="#155dfc" iconPath="/icons/book-open.svg" />}
                     title="Browse Guides"
                     subtitle="Quick Start for New Users"
                     onClick={() => navigate('/support/guides')}
                  />
                  <ActionRow
                     icon={<ImageIconBadge src="/icons/telegram-classic-filled.png" />}
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
            </section>

            <section className="flex flex-col gap-2">
               <button
                  type="button"
                  onClick={() => navigate('/request-board')}
                  className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#6010d2] px-5 py-4 text-[16px] font-[590] leading-6 tracking-[-0.02em] text-[#fdfcfd] active:scale-[0.99]"
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
               <p className="px-5 text-center text-[12px] font-normal leading-[18px] tracking-[-0.02em] text-[#62748e]">
                  You can now explore Moodeng Credit and begin your journey with confidence.
               </p>
            </section>

            <section className="flex w-full items-start gap-3 overflow-hidden rounded-[16px] border border-md-neutral-600 bg-md-neutral-300">
               <img
                  src="/hippos/thinking.png"
                  alt="Moodeng community hippo"
                  className="h-[120px] w-[136px] shrink-0 object-cover object-center"
               />
               <div className="flex min-w-0 flex-1 flex-col items-start gap-2 p-4">
                  <div className="flex w-full flex-col">
                     <p className="truncate text-[16px] font-[510] leading-6 tracking-[-0.02em] text-[#0f172b]">
                        Voices Against Unfair Loans
                     </p>
                     <p className="line-clamp-2 text-[12px] font-normal leading-[18px] tracking-[-0.02em] text-[#45556c]">
                        Join Our Facebook Community. Connect with other Moodeng Credit users
                     </p>
                  </div>
                  <button
                     type="button"
                     onClick={() => openExternal(FACEBOOK_COMMUNITY_URL)}
                     className="flex items-center gap-1 rounded-[12px] border border-[#6010d2] px-3 py-2 text-[14px] font-[590] leading-[21px] tracking-[-0.02em] text-[#6010d2] active:scale-[0.98]"
                  >
                     <span className="whitespace-nowrap">Join Our Community</span>
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
            </section>
         </main>
      </div>
   );
}
