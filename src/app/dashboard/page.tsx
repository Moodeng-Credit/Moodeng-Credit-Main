'use client';

import { useAuthGuard } from '@/hooks/useAuthGuard';

import Dashboard from '@/views/dashboard/Dashboard';

export default function DashboardPage() {
   const { isAuthenticated } = useAuthGuard();

   if (!isAuthenticated) {
      return null;
   }

   return <Dashboard />;
}
