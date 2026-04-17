import { useNavigate } from 'react-router-dom';

import NeedMoreHelp from '@/views/support/components/NeedMoreHelp';
import SupportHeader from '@/views/support/components/SupportHeader';
import { DEMO_VIDEO_ID, ICON_MASK_BASE } from '@/views/support/constants';

interface BasicsItem {
   title: string;
   description: string;
   icon: string;
   bg: string;
   path: string;
}

const BASICS: BasicsItem[] = [
   {
      title: 'Browse Guides',
      description: 'Quick Start for New Users',
      icon: 'trend-up.svg',
      bg: 'bg-[#155dfc]',
      path: '/support/guides'
   },
   {
      title: 'Browse Benefits',
      description: "See Why It's Worth It",
      icon: 'lightning.svg',
      bg: 'bg-[#00a63e]',
      path: '/benefits'
   },
   {
      title: 'Why Moodeng uses USDC',
      description: 'Learn how USDC works',
      icon: 'usdc.svg',
      bg: 'bg-[#2775ca]',
      path: '/support/guides/using-usdc-on-moodeng-credit'
   },
   {
      title: 'Learn Credit Leveling System',
      description: 'Grow Limits, Build Trust',
      icon: 'book-open.svg',
      bg: 'bg-[#9810fa]',
      path: '/support/guides/how-credit-levels-work'
   }
];

function ChevronRight() {
   return (
      <div
         className="w-6 h-6 bg-md-primary-900 shrink-0"
         style={{
            ...ICON_MASK_BASE,
            WebkitMaskImage: "url('/icons/chevron-right.svg')",
            maskImage: "url('/icons/chevron-right.svg')"
         }}
      />
   );
}

export default function GettingStarted() {
   const navigate = useNavigate();

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="max-w-[440px] mx-auto pb-28 flex flex-col">
            <SupportHeader title="Getting started" />

            <div className="flex flex-col gap-md-4 p-md-4">
               <div className="flex flex-col">
                  <h2 className="text-md-h4 font-semibold text-md-heading tracking-[-0.96px] pb-md-2">Learn the Moodeng basics</h2>
                  {BASICS.map((item, idx) => (
                     <button
                        key={item.title}
                        type="button"
                        onClick={() => navigate(item.path)}
                        className={`flex items-center gap-md-2 py-md-2 text-left bg-transparent ${
                           idx < BASICS.length - 1 ? 'border-b border-md-neutral-600' : ''
                        }`}
                     >
                        <div className={`${item.bg} rounded-[10px] w-8 h-8 shrink-0 flex items-center justify-center`}>
                           <div
                              className="w-5 h-5 bg-white"
                              style={{
                                 ...ICON_MASK_BASE,
                                 WebkitMaskImage: `url('/icons/${item.icon}')`,
                                 maskImage: `url('/icons/${item.icon}')`
                              }}
                           />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                           <span className="text-md-b1 font-medium text-md-neutral-1900">{item.title}</span>
                           <span className="text-md-b3 text-md-neutral-1200">{item.description}</span>
                        </div>
                        <ChevronRight />
                     </button>
                  ))}
               </div>

               <div className="flex flex-col gap-md-3">
                  <h2 className="text-md-h4 font-semibold text-md-heading tracking-[-0.96px]">Latest Video Guide</h2>
                  <div className="relative w-full aspect-video rounded-md-lg overflow-hidden bg-md-neutral-400">
                     <iframe
                        src={`https://www.youtube.com/embed/${DEMO_VIDEO_ID}`}
                        title="Latest Video Guide"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="absolute inset-0 w-full h-full"
                     />
                  </div>
               </div>

               <NeedMoreHelp />
            </div>
         </div>
      </div>
   );
}
