'use client';

import { useAppContext } from '@/context/AppContext';
import { useUser } from '@/query/hooks/useUsers';

export default function Page() {
   const theme = useAppContext((state) => state.theme);
   const { data: user } = useUser({ userId: '1' });
   console.log('DEBUG[1292]: user=', user);
   console.log('DEBUG[1291]: theme=', theme);
   return <div>Dashboard2</div>;
}
