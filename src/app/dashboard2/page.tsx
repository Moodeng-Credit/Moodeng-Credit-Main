'use client';

import { useAppContext } from '@/context/AppContext';

export default function Page() {
   const theme = useAppContext((state) => state.theme);
   console.log('DEBUG[1291]: theme=', theme);
   return <div>Dashboard2</div>;
}
