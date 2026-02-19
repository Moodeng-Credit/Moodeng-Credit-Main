/**
 * Central query keys for TanStack Query.
 * Use these in useQuery/useMutation queryKey and invalidateQueries.
 */
export const queryKeys = {
   all: ['api'] as const,
   health: () => [...queryKeys.all, 'health'] as const,
   auth: () => [...queryKeys.all, 'auth'] as const,
   authTest: () => [...queryKeys.auth(), 'test'] as const,
   loans: () => [...queryKeys.all, 'loans'] as const,
   loan: (id: string) => [...queryKeys.loans(), id] as const,
   user: (id: string) => [...queryKeys.all, 'user', id] as const
};
