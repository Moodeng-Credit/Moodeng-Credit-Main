import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { type BottomNavPrimaryAction, useBottomNavActionState } from '@/components/BottomNavActionContext';

import { useIsBorrower } from '@/hooks/useIsBorrower';
import type { RootState } from '@/store/store';

interface NavTab {
   label: string;
   path: string;
   icon: string;
   requiresRole?: boolean;
}

type NavItem = NavTab | { type: 'primary-action' };

const BORROWER_TABS: NavTab[] = [
   { label: 'Request Board', path: '/request-board', icon: 'request-board.png' },
   { label: 'Repay', path: '/repay', icon: 'repay.png', requiresRole: true },
   { label: 'Dashboard', path: '/dashboard', icon: 'dashboard.png', requiresRole: true },
   { label: 'History', path: '/history', icon: 'history.png', requiresRole: true },
   { label: 'Account', path: '/account', icon: 'account.png' }
];

const LENDER_TABS: NavTab[] = [
   { label: 'Request Board', path: '/request-board', icon: 'request-board.png' },
   { label: 'Dashboard', path: '/lender/dashboard', icon: 'dashboard.png' },
   { label: 'History', path: '/history', icon: 'history.png' },
   { label: 'Account', path: '/account', icon: 'account.png' }
];

const REPAY_ACTION_TABS: NavItem[] = [BORROWER_TABS[0], BORROWER_TABS[2], { type: 'primary-action' }, BORROWER_TABS[3], BORROWER_TABS[4]];

const MASK_BASE: React.CSSProperties = {
   WebkitMaskSize: 'contain',
   maskSize: 'contain',
   WebkitMaskRepeat: 'no-repeat',
   maskRepeat: 'no-repeat',
   WebkitMaskPosition: 'center',
   maskPosition: 'center'
};

function PrimaryActionSlot({ action }: { action: BottomNavPrimaryAction }) {
   const isDisabled = Boolean(action.disabled);

   return (
      <div className="pointer-events-none relative z-30 flex w-full flex-col items-center self-stretch">
         <span className="pointer-events-none absolute -top-9 left-1/2 z-0 h-[82px] w-[104px] -translate-x-1/2 rounded-t-[60px] bg-md-neutral-100" />
         <button
            type="button"
            onClick={action.onClick}
            disabled={isDisabled}
            aria-label={action.ariaLabel}
            className={[
               'relative z-50 -mt-8 flex h-16 w-16 items-center justify-center rounded-md-pill border-[6px] border-md-neutral-100 shadow-none transition focus:outline-none focus:ring-2 focus:ring-md-primary-300',
               isDisabled
                  ? 'pointer-events-none cursor-not-allowed bg-md-neutral-600 text-md-neutral-50'
                  : 'pointer-events-auto bg-md-primary-1200 text-md-neutral-50 hover:bg-md-primary-1500 active:translate-y-0.5'
            ].join(' ')}
         >
            <span
               className="h-7 w-7 bg-current"
               aria-hidden="true"
               style={{
                  ...MASK_BASE,
                  WebkitMaskImage: `url('/icons/${action.icon}')`,
                  maskImage: `url('/icons/${action.icon}')`
               }}
            />
         </button>
         <span
            className={[
               'relative z-40 mt-1 text-center text-xs font-semibold leading-none',
               isDisabled ? 'text-md-neutral-1000' : 'text-md-primary-1200'
            ].join(' ')}
         >
            {action.isProcessing ? 'Paying' : action.label}
         </span>
      </div>
   );
}

function isActiveTab(pathname: string, tabPath: string) {
   if (tabPath === '/account' || tabPath === '/history') return pathname === tabPath || pathname.startsWith(`${tabPath}/`);
   return pathname === tabPath;
}

function StandardTab({
   tab,
   isActive,
   isBorrower,
   isLocked
}: {
   tab: NavTab;
   isActive: boolean;
   isBorrower: boolean;
   isLocked: boolean;
}) {
   const showBg = isActive && isBorrower && !isLocked;
   const destination = isLocked ? '/onboarding/role' : tab.path;

   return (
      <Link
         key={tab.path}
         to={destination}
         aria-current={isActive && !isLocked ? 'page' : undefined}
         aria-disabled={isLocked ? true : undefined}
         title={isLocked ? 'Choose a role first' : undefined}
         className="relative z-40 flex w-full flex-1 flex-col items-center gap-1 self-stretch border-0 bg-transparent p-0 pointer-events-auto"
      >
         <div className={`flex h-9 w-9 shrink-0 items-center justify-center ${showBg ? 'rounded-md-md bg-md-primary-900' : ''}`}>
            <div
               className={[
                  'h-6 w-6 shrink-0',
                  isLocked ? 'bg-md-neutral-600' : showBg ? 'bg-white' : isActive ? 'bg-md-primary-900' : 'bg-md-neutral-1000'
               ].join(' ')}
               style={{
                  ...MASK_BASE,
                  WebkitMaskImage: `url('/icons/${tab.icon}')`,
                  maskImage: `url('/icons/${tab.icon}')`
               }}
            />
         </div>
         <span
            className={[
               'w-full text-center text-md-b4 font-medium',
               isLocked ? 'text-md-neutral-700' : isActive ? 'text-md-primary-900' : 'text-md-neutral-1000'
            ].join(' ')}
         >
            {tab.label}
         </span>
      </Link>
   );
}

export default function BottomNav() {
   const isBorrower = useIsBorrower();
   const userRole = useSelector((state: RootState) => state.auth.user?.userRole);
   const location = useLocation();
   const { primaryAction } = useBottomNavActionState();
   const activePrimaryAction = isBorrower && location.pathname === '/repay' && primaryAction?.path === location.pathname ? primaryAction : null;
   const navItems: NavItem[] = activePrimaryAction ? REPAY_ACTION_TABS : isBorrower ? BORROWER_TABS : LENDER_TABS;
   const needsRoleSelection = !userRole;

   return (
      <nav className="fixed bottom-[15px] left-1/2 z-50 w-[calc(100%-40px)] max-w-[400px] -translate-x-1/2 overflow-visible rounded-md-pill bg-md-neutral-100 px-5 py-3 shadow-md-nav">
         <div
            className={[
               'relative h-[60px] items-end justify-center',
               activePrimaryAction ? 'grid grid-cols-5' : 'flex'
            ].join(' ')}
         >
            {navItems.map((item) => {
               if ('type' in item) {
                  return activePrimaryAction ? <PrimaryActionSlot key="bottom-nav-primary-action" action={activePrimaryAction} /> : null;
               }

               return (
                  <StandardTab
                     key={item.path}
                     tab={item}
                     isActive={isActiveTab(location.pathname, item.path)}
                     isBorrower={isBorrower}
                     isLocked={needsRoleSelection ? Boolean(item.requiresRole) : false}
                  />
               );
            })}
         </div>
      </nav>
   );
}
