import { BarChart3, FileText, Tag, Users } from 'lucide-react';

import type { StatCardConfig } from '@/views/profile/components/tabs/types';

export const STAT_CARDS_CONFIG: StatCardConfig[] = [
   {
      key: 'repayments',
      label: 'Repayments',
      bgColor: 'bg-[#d9f6d9]',
      iconBg: 'bg-[#34c759]',
      icon: BarChart3,
      textColor: 'text-[#34c759]'
   },
   {
      key: 'active',
      label: 'Active Loans',
      bgColor: 'bg-[#fff1d6]',
      iconBg: 'bg-[#ff9b86]',
      icon: FileText,
      textColor: 'text-[#ff9b86]'
   },
   {
      key: 'defaulted',
      label: 'Defaulted',
      bgColor: 'bg-[#ffe1e1]',
      iconBg: 'bg-[#ff5a75]',
      icon: Tag,
      textColor: 'text-[#ff5a75]'
   },
   {
      key: 'pending',
      label: 'Pending Loans',
      bgColor: 'bg-[#ede0ff]',
      iconBg: 'bg-[#b18aff]',
      icon: Users,
      textColor: 'text-[#b18aff]'
   }
];
