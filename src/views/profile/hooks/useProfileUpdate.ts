import { useState } from 'react';

import { useDispatch } from 'react-redux';

import { updateUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import type { ProfileFormData } from '@/views/profile/types';

export const useProfileUpdate = (currentUserData: { username?: string; email?: string; telegramUsername?: string }) => {
   const dispatch = useDispatch<AppDispatch>();
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

   const handleUpdate = async () => {
      if (formData.telegramUsername) {
         setShowTelegramModal(true);
      }

      const data = {
         username: formData.username || currentUserData.username || '',
         email: formData.email || currentUserData.email,
         telegramUsername: formData.telegramUsername || currentUserData.telegramUsername,
         password: formData.password
      };

      await dispatch(updateUser(data))
         .unwrap()
         .then(() => {
            console.log('User updated successfully');
         })
         .catch((error: Error) => {
            console.error('Error updating user:', error.message || error);
         });

      handleRevert();
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
         const response = await fetch(import.meta.env.VITE_API_URL + '/auth/test-email', {
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
