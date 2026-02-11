
import { useAuthGuard } from '@/hooks/useAuthGuard';

import History from '@/views/history/History';

export default function HistoryPage() {
   const { isAuthenticated } = useAuthGuard();

   if (!isAuthenticated) {
      return null;
   }

   return <History />;
}
