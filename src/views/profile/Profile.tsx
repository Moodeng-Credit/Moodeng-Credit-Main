'use client';

import { useCallback, useEffect, useState } from 'react';

import { useSelector } from 'react-redux';
import { useAccount } from 'wagmi';

import { useUpdateUser, useUserLoans } from '@/hooks/api';

import type { RootState } from '@/store/store';
import { MobileNav, Sidebar } from '@/views/profile/components/navigation';
import { FilterButtons, RoleSwitcher, TelegramModal } from '@/views/profile/components/shared';
import { DashboardTab, FAQTab, LoanSummaryTab, SettingsTab, SupportTab, TransactionHistoryTab } from '@/views/profile/components/tabs';
import { INFO_NAV_ITEMS, INITIAL_NAV_ITEMS } from '@/views/profile/constants';
import { useProfileUpdate } from '@/views/profile/hooks';
import { ProfileTab, UserRole } from '@/views/profile/types';

export default function Profile() {
   const account = useAccount();
   const [navItems, setNavItems] = useState(INITIAL_NAV_ITEMS);
   const [infoNavItems, setInfoNavItems] = useState(INFO_NAV_ITEMS);
   const [userRole, setUserRole] = useState<UserRole>(UserRole.LENDER);

   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const { data: loansData } = useUserLoans(username || '');
   const loans = loansData?.gloans || [];
   const updateUser = useUpdateUser();

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
      username: username || '',
      email: user?.email,
      telegramUsername: user?.telegramUsername
   });

   useEffect(() => {
      const currentWalletAddress = user?.walletAddress;
      if (account.isConnected && account.address && username) {
         if (currentWalletAddress !== account.address) {
            updateUser.mutate(
               { walletAddress: account.address },
               {
                  onSuccess: () => {
                     console.log('Wallet address saved successfully');
                  },
                  onError: (error) => {
                     console.error('Failed to save wallet address:', error);
                  }
               }
            );
         }
      }
   }, [account.isConnected, account.address, username, user?.walletAddress, updateUser]);

   const activeTab = navItems.find((item) => item.active)?.label || infoNavItems.find((item) => item.active)?.label || ProfileTab.DASHBOARD;

   const handleNavItemClick = (label: string) => {
      setNavItems((prevItems) => prevItems.map((item) => ({ ...item, active: item.label === label })));
      setInfoNavItems((prevItems) => prevItems.map((item) => ({ ...item, active: item.label === label })));
   };

   const handleCloseTelegramModal = useCallback(() => {
      setShowTelegramModal(false);
   }, [setShowTelegramModal]);

   const renderTabContent = () => {
      switch (activeTab) {
         case ProfileTab.DASHBOARD:
            return <DashboardTab />;

         case ProfileTab.LOAN_SUMMARY:
            return <LoanSummaryTab loans={loans} currentUsername={username || ''} userRole={userRole} />;

         case ProfileTab.TRANSACTION_HISTORY:
            return <TransactionHistoryTab loans={loans} currentUsername={username || ''} userRole={userRole} />;

         case ProfileTab.SETTINGS:
            return (
               <SettingsTab
                  username={formData.username || ''}
                  email={formData.email || ''}
                  telegramUsername={formData.telegramUsername || ''}
                  password={formData.password || ''}
                  currentUsername={username || ''}
                  currentEmail={user?.email || ''}
                  currentTelegramUsername={user?.telegramUsername || ''}
                  walletAddress={user?.walletAddress || ''}
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
