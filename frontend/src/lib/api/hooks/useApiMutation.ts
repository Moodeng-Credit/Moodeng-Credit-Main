import type { UseMutationOptions } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';

import { apiClient } from '@/lib/api/client';

type Method = 'post' | 'put' | 'delete';

/**
 * Generic useMutation for API mutations.
 *
 * @example
 * const mutation = useApiMutation(
 *   ['create-loan'],
 *   'post',
 *   '/loans',
 *   { onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.loans() }) }
 * );
 * mutation.mutate({ loanAmount: 100 });
 */
export function useApiMutation<TData = unknown, TVariables = unknown>(
   mutationKey: readonly unknown[],
   method: Method,
   path: string,
   options?: Omit<
      UseMutationOptions<TData, Error, TVariables>,
      'mutationKey' | 'mutationFn'
   >
) {
   return useMutation<TData, Error, TVariables>({
      mutationKey,
      mutationFn: (body?: TVariables) =>
         method === 'delete'
            ? apiClient.delete<TData>(path)
            : apiClient[method]<TData>(path, body),
      ...options
   });
}
