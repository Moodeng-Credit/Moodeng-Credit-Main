import type { NavItem } from '@/views/profile/types';
import { ProfileTab } from '@/views/profile/types';

export const INITIAL_NAV_ITEMS: NavItem[] = [
   { label: ProfileTab.DASHBOARD, icon: 'fa-home', active: true },
   { label: ProfileTab.LOAN_SUMMARY, icon: 'fa-money-bill-wave', active: false },
   { label: ProfileTab.TRANSACTION_HISTORY, icon: 'fa-history', active: false },
   { label: ProfileTab.SETTINGS, icon: 'fa-cog', active: false }
];

export const INFO_NAV_ITEMS: NavItem[] = [
   { label: ProfileTab.FAQ, icon: 'fa-question-circle', active: false },
   { label: ProfileTab.SUPPORT, icon: 'fa-headset', active: false }
];
