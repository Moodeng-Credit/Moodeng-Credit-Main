import type { ActionButtonConfig } from '@/types/actionButtonTypes';

export const heroSectionButtons: ActionButtonConfig[] = [
   {
      text: 'Borrow',
      bgColor: 'bg-[#6d57ff]',
      textColor: 'text-[#f6f6f6]',
      href: '/dashboard#request',
      width: 'w-[170px]'
   },
   {
      text: 'Lend',
      bgColor: 'bg-[#4de5a6]',
      textColor: 'text-[#171420]',
      href: '/dashboard#request',
      width: 'w-40'
   },
   {
      text: 'Chat',
      bgColor: 'bg-[#f093ff]',
      textColor: 'text-[#171420]',
      href: `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}`,
      isExternal: true,
      width: 'w-44'
   },
   {
      text: 'Get Help',
      bgColor: 'bg-[#ff9900]',
      textColor: 'text-[#171420]',
      href: 'https://moodeng-credit.gitbook.io/moodeng-credit',
      isExternal: true,
      width: 'w-[155px]'
   }
];

export const financialInclusionButtons: ActionButtonConfig[] = [
   {
      text: 'See How it Works',
      bgColor: 'bg-[#171420]',
      textColor: 'text-[#f6f6f6]',
      href: '/guide#guide',
      width: 'w-[209px]'
   }
];

export const revolutionizeButtons: ActionButtonConfig[] = [
   {
      text: 'See More Benefits',
      bgColor: 'bg-[#f6f6f6]',
      textColor: 'text-[#171420]',
      href: '/benefits#benefits',
      width: 'w-[230px]'
   }
];

export const whyLendButtons: ActionButtonConfig[] = [
   {
      text: 'See Why',
      bgColor: 'bg-[#171420]',
      textColor: 'text-[#f6f6f6]',
      href: '/whylend#why-lend',
      width: 'w-[209px]'
   }
];

export const aboutHeroButtons: ActionButtonConfig[] = [
   {
      text: 'See Request Board',
      bgColor: 'bg-[#f6f6f6]',
      textColor: 'text-[#171420]',
      href: '/dashboard#request',
      width: 'w-[265px]'
   }
];

export const creditSystemButtons: ActionButtonConfig[] = [
   {
      text: 'Borrow',
      bgColor: 'bg-indigo-500',
      textColor: 'text-neutral-100',
      href: '/dashboard#request',
      width: 'w-[194px]'
   },
   {
      text: 'Lend',
      bgColor: 'bg-emerald-400',
      textColor: 'text-zinc-900',
      href: '/dashboard#request',
      width: 'w-[182px]'
   }
];

export const mostNeededLendingButtons: ActionButtonConfig[] = [
   {
      text: 'Start Lending',
      bgColor: 'bg-indigo-500',
      textColor: 'text-neutral-100',
      href: '/dashboard#request',
      width: 'w-[402px]'
   }
];

export const verifyIdentityButtons: ActionButtonConfig[] = [
   {
      text: 'Read Docs',
      bgColor: 'bg-white',
      textColor: 'text-blue-700',
      href: 'https://moodeng-credit.gitbook.io/moodeng-credit',
      isExternal: true,
      width: 'w-full p-4'
   }
];
