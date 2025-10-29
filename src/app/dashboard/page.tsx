'use client';

import Dashboard from '@/views/dashboard/Dashboard';

import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function DashboardPage() {
   const { isAuthenticated } = useAuthGuard();

   if (!isAuthenticated) {
      return null;
   }

   return <Dashboard />;
}
