'use client';

import Board from '@/components/board/Board';

import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function DashboardPage() {
   const { isAuthenticated } = useAuthGuard();

   if (!isAuthenticated) {
      return null;
   }

   return <Board />;
}
