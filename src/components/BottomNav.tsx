import { NavLink, useLocation } from 'react-router-dom';

import { type BottomNavPrimaryAction, useBottomNavActionState } from '@/components/BottomNavActionContext';

import { useIsBorrower } from '@/hooks/useIsBorrower';

interface NavTab {
   label: string;
   path: string;
   icon: string;
}

type NavItem = NavTab | { type: 'primary-action' };

const BORROWER_TABS: NavTab[] = [
   { label: 'Request Board', path: '/request-board', icon: 'request-board.png' },
   { label: 'Repay', path: '/repay', icon: 'repay.png' },
   { label: 'Dashboard', path: '/dashboard', icon: 'dashboard.png' },
   { label: 'History', path: '/history', icon: 'history.png' },
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
      <div className="relative flex flex-1 flex-col items-center self-stretch">
         <span className="pointer-events-none absolute -top-7 left-1/2 h-[70px] w-[88px] -translate-x-1/2 rounded-t-[52px] bg-md-neutral-100" />
         <button
            type="button"
            onClick={action.onClick}
            disabled={isDisabled}
            aria-label={action.ariaLabel}
            className={[
               'relative z-10 -mt-6 flex h-14 w-14 items-center justify-center rounded-md-pill border-[5px] border-md-neutral-100 transition focus:outline-none focus:ring-2 focus:ring-md-primary-300',
               isDisabled
                  ? 'cursor-not-allowed bg-md-neutral-600 text-md-neutral-50'
                  : 'bg-md-primary-1200 text-md-neutral-50 shadow-[0_14px_26px_rgba(96,16,210,0.28)] hover:bg-md-primary-1500 active:translate-y-0.5'
            ].join(' ')}
         >
            <span
               className="h-6 w-6 bg-current"
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
               'relative z-10 mt-1 text-center text-[11px] font-semibold leading-none',
               isDisabled ? 'text-md-neutral-1000' : 'text-md-primary-1200'
            ].join(' ')}
         >
            {action.isProcessing ? 'Paying' : action.label}
         </span>
      </div>
   );
}

function StandardTab({ tab, isBorrower }: { tab: NavTab; isBorrower: boolean }) {
   return (
      <NavLink
         key={tab.path}
         to={tab.path}
         end={tab.path !== '/account' && tab.path !== '/history'}
         className="flex flex-1 flex-col items-center gap-1 self-stretch"
      >
         {({ isActive }) => {
            const showBg = isActive && isBorrower;

            return (
               <>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center ${showBg ? 'rounded-md-md bg-md-primary-900' : ''}`}>
                     <div
                        className={`h-6 w-6 shrink-0 ${showBg ? 'bg-white' : isActive ? 'bg-md-primary-900' : 'bg-md-neutral-1000'}`}
                        style={{
                           ...MASK_BASE,
                           WebkitMaskImage: `url('/icons/${tab.icon}')`,
                           maskImage: `url('/icons/${tab.icon}')`
                        }}
                     />
                  </div>
                  <span
                     className={`w-full text-center text-md-b4 font-medium ${isActive ? 'text-md-primary-900' : 'text-md-neutral-1000'}`}
                  >
                     {tab.label}
                  </span>
               </>
            );
         }}
      </NavLink>
   );
}

export default function BottomNav() {
   const isBorrower = useIsBorrower();
   const location = useLocation();
   const { primaryAction } = useBottomNavActionState();
   const activePrimaryAction = isBorrower && primaryAction?.path === location.pathname ? primaryAction : null;
   const navItems: NavItem[] = activePrimaryAction ? REPAY_ACTION_TABS : isBorrower ? BORROWER_TABS : LENDER_TABS;

   return (
      <nav className="fixed bottom-[15px] left-1/2 z-50 w-[calc(100%-40px)] max-w-[400px] -translate-x-1/2 overflow-visible rounded-md-pill bg-md-neutral-100 px-5 py-3 shadow-md-nav">
         <div className="relative flex h-[60px] items-end justify-center">
            {navItems.map((item) => {
               if ('type' in item) {
                  return activePrimaryAction ? <PrimaryActionSlot key="bottom-nav-primary-action" action={activePrimaryAction} /> : null;
               }

               return <StandardTab key={item.path} tab={item} isBorrower={isBorrower} />;
            })}
         </div>
      </nav>
   );
}
