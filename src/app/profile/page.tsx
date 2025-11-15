'use client';

import { useAuthGuard } from '@/hooks/useAuthGuard';

import Profile from '@/views/profile/Profile';

export default function ProfilePage() {
   const { isAuthenticated } = useAuthGuard();

   if (!isAuthenticated) {
      return null;
   }

   return <Profile />;
}
