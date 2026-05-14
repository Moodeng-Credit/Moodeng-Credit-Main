import { type ReactNode, useState } from 'react';

import { useSelector } from 'react-redux';
import { Link, NavLink } from 'react-router-dom';

import UserAvatar from '@/components/UserAvatar';
import type { RootState } from '@/store/store';

interface MarketingPageShellProps {
   children: ReactNode;
}

const navItems = [
   { label: 'Borrow', href: '/benefits' },
   { label: 'Lend', href: '/whylend' },
   { label: 'Academy', href: '/academy' }
];

const LogoMark = ({ className = 'size-12' }: { className?: string }) => (
   <span className={`inline-flex shrink-0 items-center justify-center rounded-md-lg ${className}`}>
      <img src="/brand/moodeng-logo.png" alt="Moodeng Credit logo" className="h-full w-full object-contain" />
   </span>
);

export default function MarketingPageShell({ children }: MarketingPageShellProps) {
   const [isMenuOpen, setIsMenuOpen] = useState(false);
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const isSignedIn = Boolean(user?.id && username);
   const appHref = user?.id && username ? (user.userRole === 'lender' ? '/lender/dashboard' : '/dashboard') : '/sign-up';
   const appLabel = isSignedIn ? 'Open App' : 'Sign up';

   return (
      <div className="min-h-screen bg-[#fbfafd] text-md-heading">
         <header className="sticky top-0 z-50 border-b border-md-neutral-300/80 bg-[#fbfafd]/95 backdrop-blur">
            <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-md-4 md:h-20 md:px-md-5">
               <Link to="/" className="flex min-w-0 items-center gap-md-2" onClick={() => setIsMenuOpen(false)}>
                  <LogoMark className="size-12" />
                  <span className="truncate text-md-h5 text-md-heading">Moodeng Credit</span>
               </Link>

               <nav
                  className="hidden items-center gap-md-1 rounded-md-pill bg-white p-1 shadow-md-card md:flex"
                  aria-label="Benefits navigation"
               >
                  {navItems.map((item) => (
                     <NavLink
                        key={item.href}
                        to={item.href}
                        className={({ isActive }) =>
                           `rounded-md-pill px-md-3 py-md-1 text-md-b2 font-semibold transition ${
                              isActive ? 'bg-md-primary-1200 text-white' : 'text-md-neutral-1400 hover:bg-md-neutral-200'
                           }`
                        }
                     >
                        {item.label}
                     </NavLink>
                  ))}
               </nav>

               <div className="flex items-center gap-md-1">
                  {isSignedIn ? (
                     <UserAvatar
                        size={44}
                        alt={username ? `${username} profile` : 'Profile'}
                        className="border-2 border-white shadow-md-card"
                     />
                  ) : null}
                  <Link
                     to={appHref}
                     className="inline-flex h-11 items-center justify-center rounded-md-pill bg-md-primary-1200 px-md-3 text-md-b2 font-semibold text-white shadow-md-card"
                  >
                     {appLabel}
                  </Link>
                  <button
                     type="button"
                     className="inline-flex size-11 items-center justify-center rounded-md-pill bg-white text-md-primary-2000 shadow-md-card md:hidden"
                     aria-label="Toggle benefits menu"
                     aria-expanded={isMenuOpen}
                     onClick={() => setIsMenuOpen((value) => !value)}
                  >
                     <span className="h-0.5 w-5 rounded-full bg-current shadow-[0_6px_0_currentColor,0_-6px_0_currentColor]" />
                  </button>
               </div>
            </div>

            {isMenuOpen ? (
               <nav
                  className="border-t border-md-neutral-300 bg-[#fbfafd] px-md-4 py-md-3 md:hidden"
                  aria-label="Mobile benefits navigation"
               >
                  <div className="mx-auto flex max-w-[440px] flex-col gap-md-1">
                     {navItems.map((item) => (
                        <NavLink
                           key={item.href}
                           to={item.href}
                           onClick={() => setIsMenuOpen(false)}
                           className={({ isActive }) =>
                              `rounded-md-lg px-md-3 py-md-3 text-md-b1 font-semibold ${
                                 isActive ? 'bg-md-primary-1200 text-white' : 'bg-white text-md-neutral-1500'
                              }`
                           }
                        >
                           {item.label}
                        </NavLink>
                     ))}
                  </div>
               </nav>
            ) : null}
         </header>

         <main>{children}</main>

         <footer className="border-t border-md-neutral-300 bg-[#fbfafd] px-md-4 py-md-6">
            <div className="mx-auto grid w-full max-w-[1120px] gap-md-5 rounded-md-xl border border-md-neutral-300 bg-white p-md-5 shadow-md-card md:grid-cols-[1.2fr_0.8fr_0.8fr]">
               <div className="max-w-[460px]">
                  <Link to="/" className="inline-flex items-center gap-md-2">
                     <LogoMark className="size-11" />
                     <span className="text-md-h5 text-md-heading">Moodeng Credit</span>
                  </Link>
                  <p className="mt-md-2 text-md-b2 font-medium text-md-neutral-700">
                     Small USDC loans, World ID verification, and portable repayment history for borrowers building credit abroad.
                  </p>
                  <p className="mt-md-3 text-md-b3 font-semibold uppercase tracking-[0.12em] text-md-neutral-700">© 2026 Moodeng Credit</p>
               </div>

               <div>
                  <p className="text-md-b2 font-semibold uppercase tracking-[0.12em] text-md-neutral-700">Explore</p>
                  <nav className="mt-md-2 flex flex-col gap-md-1 text-md-b2 font-semibold text-md-heading">
                     <Link to="/benefits" className="hover:text-md-primary-1200">
                        Borrower benefits
                     </Link>
                     <Link to="/whylend" className="hover:text-md-primary-1200">
                        Why lend
                     </Link>
                     <Link to="/academy" className="hover:text-md-primary-1200">
                        Academy
                     </Link>
                  </nav>
               </div>

               <div>
                  <p className="text-md-b2 font-semibold uppercase tracking-[0.12em] text-md-neutral-700">Next step</p>
                  <div className="mt-md-2 flex flex-col gap-md-2">
                     <Link
                        to={appHref}
                        className="inline-flex h-11 items-center justify-center rounded-md-pill bg-md-primary-1200 px-md-3 text-md-b2 font-semibold text-white"
                     >
                        {appLabel}
                     </Link>
                     <a
                        href="https://moodeng-credit.gitbook.io/moodeng-credit"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-11 items-center justify-center rounded-md-pill border border-md-primary-1200 px-md-3 text-md-b2 font-semibold text-md-primary-1200"
                     >
                        Read docs
                     </a>
                  </div>
               </div>
            </div>
         </footer>
      </div>
   );
}
