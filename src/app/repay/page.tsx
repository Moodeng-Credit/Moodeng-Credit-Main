
import { useAuthGuard } from '@/hooks/useAuthGuard';

import Repay from '@/views/repay/Repay';

export default function RepayPage() {
   const { isAuthenticated } = useAuthGuard();

   if (!isAuthenticated) {
      return null;
   }

   return <Repay />;
}
