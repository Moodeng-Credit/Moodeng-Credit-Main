import { useQuery } from '@tanstack/react-query';

import { queries } from '@/query/keys/queries';

export function useUser({ userId }: { userId: string }) {
   return useQuery({
      ...queries.users.detail(userId)
   });
}
