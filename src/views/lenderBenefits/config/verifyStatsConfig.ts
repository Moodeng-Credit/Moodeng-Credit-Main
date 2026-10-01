import { BadgeCheck, Globe2, type LucideIcon, ShieldCheck } from 'lucide-react';

export interface VerifyStatsCardProps {
   title: string;
   titleColor: string;
   subtitle: string;
   description: string;
   icon: LucideIcon;
   accentColor: string;
   accentSoftColor: string;
}

export const VerifyStatsCardConfig: VerifyStatsCardProps[] = [
   {
      title: 'Identity verified',
      titleColor: 'text-sky-600',
      subtitle: 'Real-person signal',
      description: 'Borrowers pass a quick ID + selfie check, or verify with World ID, before they can request funding.',
      icon: BadgeCheck,
      accentColor: '#0ea5e9',
      accentSoftColor: '#e0f2fe'
   },
   {
      title: 'Worker hubs first',
      titleColor: 'text-indigo-600',
      subtitle: 'SEA worker corridors',
      description: 'We start with overseas worker hubs, including South Korea, Taiwan, Japan, Singapore, and nearby cities.',
      icon: Globe2,
      accentColor: '#6366f1',
      accentSoftColor: '#eef2ff'
   },
   {
      title: 'One borrower record',
      titleColor: 'text-emerald-600',
      subtitle: 'Less repeat-account risk',
      description: 'A verified borrower can build repayment history around one account instead of restarting with every new loan.',
      icon: ShieldCheck,
      accentColor: '#10b981',
      accentSoftColor: '#ecfdf5'
   }
];
