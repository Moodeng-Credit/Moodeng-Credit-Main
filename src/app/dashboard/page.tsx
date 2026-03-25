import Dashboard from '@/views/dashboard/Dashboard';

/** Auth is enforced by `<ProtectedRoute>`; avoid a second guard that returned `null` and caused a blank flash. */
export default function DashboardPage() {
   return <Dashboard />;
}
