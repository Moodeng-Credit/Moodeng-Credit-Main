import { useAuthGuard } from '@/hooks/useAuthGuard';

import LenderBoard from '@/views/lenderBoard/LenderBoard';

export default function LenderBoardPage() {
   const { isAuthenticated } = useAuthGuard();

   if (!isAuthenticated) {
      return null;
   }

   return <LenderBoard />;
}
