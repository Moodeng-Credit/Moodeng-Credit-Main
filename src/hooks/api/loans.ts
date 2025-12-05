import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { API_ENDPOINTS } from '@/config/apiEndpoints';
import { apiHandler } from '@/lib/apiHandler';
import { type Loan } from '@/types/loanTypes';

export interface UserLoansResponse {
   gloans: Loan[];
}

// Query Keys
export const loanKeys = {
   all: ['loans'] as const,
   list: () => [...loanKeys.all, 'list'] as const,
   user: (username: string) => [...loanKeys.all, 'user', username] as const
};

// Queries
export const useLoans = () => {
   return useQuery({
      queryKey: loanKeys.list(),
      queryFn: async (): Promise<Loan[]> => {
         return await apiHandler.get(API_ENDPOINTS.LOANS.FETCH);
      }
   });
};

export const useUserLoans = (username: string) => {
   return useQuery({
      queryKey: loanKeys.user(username),
      queryFn: async (): Promise<UserLoansResponse> => {
         const response = await apiHandler.post(API_ENDPOINTS.LOANS.GET, { username });
         const loans = response.gloans || response || [];
         return { gloans: loans };
      },
      enabled: !!username
   });
};

// Mutations
interface CreateLoanData {
   borrowerUserId: string;
   lenderUserId: string;
   loanAmount: number;
   totalRepaymentAmount: number;
   block?: string;
   coin?: string;
   reason: string;
   days: number;
}

export const useCreateLoan = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async (data: CreateLoanData): Promise<Loan> => {
         return await apiHandler.post(API_ENDPOINTS.LOANS.CREATE, data as unknown as Record<string, unknown>);
      },
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: loanKeys.all });
      }
   });
};

interface UpdateLoanStatusData {
   id: string;
   username?: string | null;
   wallet?: string;
   repaymentStatus?: string;
   loanStatus?: string;
   repaidAmount?: number;
   hash?: string;
}

export const useUpdateLoanStatus = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async (data: UpdateLoanStatusData): Promise<Loan> => {
         const { id, ...rest } = data;
         return await apiHandler.post(API_ENDPOINTS.LOANS.UPDATE, {
            loanId: id,
            ...rest
         });
      },
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: loanKeys.all });
      }
   });
};

export const useDeleteLoan = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async (loanId: string): Promise<void> => {
         await apiHandler.post(API_ENDPOINTS.LOANS.DELETE, { loanId });
      },
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: loanKeys.all });
      }
   });
};
