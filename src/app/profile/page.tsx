'use client';

import Profile from '@/views/profile/Profile';

import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function ProfilePage() {
   const { isAuthenticated } = useAuthGuard();

   if (!isAuthenticated) {
      return null;
   }

   return <Profile />;
}
