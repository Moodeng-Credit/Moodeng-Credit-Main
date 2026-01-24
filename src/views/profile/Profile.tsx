

import { useCallback, useEffect, useState } from 'react';

import { useDispatch } from 'react-redux';

import { MobileNav, Sidebar } from '@/views/profile/components/navigation';
import { FilterButtons, RoleSwitcher, TelegramModal } from '@/views/profile/components/shared';
import { DashboardTab, FAQTab, LoanSummaryTab, SettingsTab, SupportTab, TransactionHistoryTab } from '@/views/profile/components/tabs';
import { INFO_NAV_ITEMS, INITIAL_NAV_ITEMS } from '@/views/profile/constants';
import { useLoanData, useProfileData, useProfileUpdate } from '@/views/profile/hooks';
import { ProfileTab, UserRole } from '@/views/profile/types';
import { fetchUserProfiles } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';

export default function Profile() {
   const dispatch = useDispatch<AppDispatch>();
   const [navItems, setNavItems] = useState(INITIAL_NAV_ITEMS);
   const [infoNavItems, setInfoNavItems] = useState(INFO_NAV_ITEMS);
   const [userRole, setUserRole] = useState<UserRole>(UserRole.LENDER);

   const { user } = useProfileData();
   const { loans } = useLoanData(user.user?.id || '');
   const {
      formData,
      updateField,
      handleUpdate,
      handleRevert,
      handleTestEmail,
      isSendingTestEmail,
      showTelegramModal,
      setShowTelegramModal
   } = useProfileUpdate({
      username: user.username || '',
      email: user.user?.email,
      telegramUsername: user.user?.telegramUsername
   });

   const activeTab = navItems.find((item) => item.active)?.label || infoNavItems.find((item) => item.active)?.label || ProfileTab.DASHBOARD;

   const handleNavItemClick = (label: string) => {
      setNavItems((prevItems) => prevItems.map((item) => ({ ...item, active: item.label === label })));
      setInfoNavItems((prevItems) => prevItems.map((item) => ({ ...item, active: item.label === label })));
   };

   const handleCloseTelegramModal = useCallback(() => {
      setShowTelegramModal(false);
   }, [setShowTelegramModal]);

   useEffect(() => {
      const loanUserIds = [
         ...new Set(
            loans
               .flatMap((loan) => [loan.borrowerUser, loan.lenderUser])
               .filter(Boolean)
         )
      ] as string[];

      if (loanUserIds.length > 0) {
         dispatch(fetchUserProfiles(loanUserIds)).catch(() => undefined);
      }
   }, [dispatch, loans]);

   const handlePayLoansNow = () => {
      handleNavItemClick(ProfileTab.LOAN_SUMMARY);
      setUserRole(UserRole.BORROWER);
   };

   const renderTabContent = () => {
      switch (activeTab) {
         case ProfileTab.DASHBOARD:
            return <DashboardTab onPayLoansNow={handlePayLoansNow} />;

         case ProfileTab.LOAN_SUMMARY:
            return <LoanSummaryTab loans={loans} currentUserId={user.user?.id || ''} userRole={userRole} />;

         case ProfileTab.TRANSACTION_HISTORY:
            return <TransactionHistoryTab loans={loans} currentUserId={user.user?.id || ''} userRole={userRole} />;

         case ProfileTab.SETTINGS:
            return (
               <SettingsTab
                  username={formData.username || ''}
                  email={formData.email || ''}
                  telegramUsername={formData.telegramUsername || ''}
                  password={formData.password || ''}
                  currentUsername={user.username || ''}
                  currentEmail={user.user?.email || ''}
                  currentTelegramUsername={user.user?.telegramUsername || ''}
                  walletAddress={user.user?.walletAddress || ''}
                  onUsernameChange={(value) => updateField('username', value)}
                  onEmailChange={(value) => updateField('email', value)}
                  onTelegramChange={(value) => updateField('telegramUsername', value)}
                  onPasswordChange={(value) => updateField('password', value)}
                  onUpdate={handleUpdate}
                  onRevert={handleRevert}
                  isSendingTestEmail={isSendingTestEmail}
                  onTestEmail={handleTestEmail}
               />
            );

         case ProfileTab.FAQ:
            return <FAQTab />;

         case ProfileTab.SUPPORT:
            return <SupportTab />;

         default:
            return <DashboardTab />;
      }
   };

   const showRoleSwitcher = activeTab !== ProfileTab.SETTINGS;
   const showFilterButtons = activeTab === ProfileTab.LOAN_SUMMARY || activeTab === ProfileTab.TRANSACTION_HISTORY;

   return (
      <div className="bg-[#c9d5f9] min-h-screen flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>
         <main className="flex flex-col md:flex-row flex-1 overflow-hidden">
            <Sidebar navItems={navItems} infoNavItems={infoNavItems} onNavItemClick={handleNavItemClick} />
            <MobileNav navItems={navItems} infoNavItems={infoNavItems} onNavItemClick={handleNavItemClick} />

            <section className="flex-1 p-4 md:p-8 overflow-auto">
               {showRoleSwitcher ? <RoleSwitcher currentRole={userRole} onRoleChange={setUserRole} /> : null}
               {showFilterButtons ? <FilterButtons userRole={userRole} /> : null}

               <div className="overflow-x-auto">{renderTabContent()}</div>
            </section>
         </main>

         <TelegramModal isOpen={showTelegramModal} onClose={handleCloseTelegramModal} />
      </div>
   );
}
