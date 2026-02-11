import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';
import { queryKeys } from '@/lib/api/query-keys';

export function useHealthCheck(options?: { enabled?: boolean }) {
   return useQuery({
      queryKey: queryKeys.health(),
      queryFn: () => apiClient.get<{ status: string }>('/health'),
      enabled: options?.enabled ?? true,
      staleTime: 30_000
   });
}
