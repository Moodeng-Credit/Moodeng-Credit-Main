import type { UseQueryOptions } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

/**
 * Generic useQuery wrapper for GET API calls.
 * Use for any endpoint that returns JSON.
 *
 * @example
 * const { data, isLoading, error } = useApiQuery(
 *   ['loans'],
 *   '/loans'
 * );
 */
export function useApiQuery<TData = unknown>(
   queryKey: readonly unknown[],
   path: string,
   options?: Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>
) {
   return useQuery<TData>({
      queryKey,
      queryFn: () => apiClient.get<TData>(path),
      ...options
   });
}
