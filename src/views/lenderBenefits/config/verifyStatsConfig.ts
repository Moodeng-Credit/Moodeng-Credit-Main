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
      title: 'World ID verified',
      titleColor: 'text-sky-600',
      subtitle: 'Real-person signal',
      description: 'Borrowers prove they are a unique human through World ID before they can request funding.',
      icon: BadgeCheck,
      accentColor: '#0ea5e9',
      accentSoftColor: '#e0f2fe'
   },
   {
      title: 'Orb-first markets',
      titleColor: 'text-indigo-600',
      subtitle: 'SEA worker corridors',
      description: 'We start where Orb access is practical, including South Korea, Taiwan, Japan, Singapore, and nearby hubs.',
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
