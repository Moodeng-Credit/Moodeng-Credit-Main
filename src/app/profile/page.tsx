'use client';

import Dash from '@/components/board/Dash';

import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function ProfilePage() {
   const { isAuthenticated } = useAuthGuard();

   if (!isAuthenticated) {
      return null;
   }

   return <Dash />;
}
