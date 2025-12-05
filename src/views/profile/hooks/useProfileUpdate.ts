import { useState } from 'react';

import { useUpdateUser } from '@/hooks/api';

import type { ProfileFormData } from '@/views/profile/types';

export const useProfileUpdate = (currentUserData: { username?: string; email?: string; telegramUsername?: string }) => {
   const updateUser = useUpdateUser();
   const [formData, setFormData] = useState<ProfileFormData>({
      username: '',
      email: '',
      telegramUsername: '',
      password: ''
   });
   const [showTelegramModal, setShowTelegramModal] = useState(false);
   const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

   const updateField = (field: keyof ProfileFormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
   };

   const handleUpdate = () => {
      if (formData.telegramUsername) {
         setShowTelegramModal(true);
      }

      const data = {
         username: formData.username || currentUserData.username || '',
         email: formData.email || currentUserData.email,
         telegramUsername: formData.telegramUsername || currentUserData.telegramUsername,
         password: formData.password
      };

      updateUser.mutate(data, {
         onSuccess: () => {
            console.log('User updated successfully');
            handleRevert();
         },
         onError: (error) => {
            console.error('Error updating user:', error.message || error);
         }
      });
   };

   const handleRevert = () => {
      setFormData({
         username: '',
         email: '',
         telegramUsername: '',
         password: ''
      });
   };

   const handleTestEmail = async () => {
      setIsSendingTestEmail(true);
      try {
         const response = await fetch('/api/auth/test-email', {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json'
            }
         });

         if (!response.ok) {
            throw new Error('Failed to send test email');
         }

         const data = await response.json();
         window.alert(data.message || 'Test email sent! Check your inbox.');
      } catch (error) {
         console.error('Error sending test email:', error);
         window.alert('Failed to send test email. Please try again.');
      } finally {
         setIsSendingTestEmail(false);
      }
   };

   return {
      formData,
      updateField,
      handleUpdate,
      handleRevert,
      handleTestEmail,
      isSendingTestEmail,
      showTelegramModal,
      setShowTelegramModal
   };
};
