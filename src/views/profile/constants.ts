import { Banknote, Headphones, HelpCircle, History, Home, Settings } from 'lucide-react';

import type { NavItem } from '@/views/profile/types';
import { ProfileTab } from '@/views/profile/types';

export const INITIAL_NAV_ITEMS: NavItem[] = [
   { label: ProfileTab.DASHBOARD, icon: Home, active: true },
   { label: ProfileTab.LOAN_SUMMARY, icon: Banknote, active: false },
   { label: ProfileTab.TRANSACTION_HISTORY, icon: History, active: false },
   { label: ProfileTab.SETTINGS, icon: Settings, active: false }
];

export const INFO_NAV_ITEMS: NavItem[] = [
   { label: ProfileTab.FAQ, icon: HelpCircle, active: false },
   { label: ProfileTab.SUPPORT, icon: Headphones, active: false }
];
