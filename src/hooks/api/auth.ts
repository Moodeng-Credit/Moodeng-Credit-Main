import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { API_ENDPOINTS } from '@/config/apiEndpoints';
import { apiHandler } from '@/lib/apiHandler';
import { clearAuthCookieClient } from '@/lib/utils/cookieConfig';
import { clearAuth, setUser } from '@/store/slices/authSlice';
import { store } from '@/store/store';
import { type User } from '@/types/authTypes';

// Query Keys
export const authKeys = {
   all: ['user'] as const,
   me: () => [...authKeys.all, 'me'] as const,
   profile: (username: string) => [...authKeys.all, 'profile', username] as const
};

// Queries
export const useCurrentUser = () => {
   return useQuery({
      queryKey: authKeys.me(),
      queryFn: async (): Promise<User> => {
         return await apiHandler.get(API_ENDPOINTS.AUTH.ME);
      }
   });
};

export const useUserProfile = (username: string) => {
   return useQuery({
      queryKey: authKeys.profile(username),
      queryFn: async (): Promise<User> => {
         return await apiHandler.post(API_ENDPOINTS.AUTH.PROFILE, { username });
      },
      enabled: !!username
   });
};

// Mutations
interface LoginCredentials {
   username: string;
   password: string;
}

interface LoginResponse {
   user: User;
   username: string;
}

export const useLogin = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async (credentials: LoginCredentials): Promise<LoginResponse> => {
         await apiHandler.post(API_ENDPOINTS.AUTH.LOGIN, credentials as unknown as Record<string, unknown>);
         const user = await apiHandler.get(API_ENDPOINTS.AUTH.ME);
         return { user, username: credentials.username };
      },
      onSuccess: (data) => {
         queryClient.setQueryData(authKeys.me(), data.user);
         store.dispatch(setUser(data.user));
      }
   });
};

interface GoogleCredentials {
   googleCredential: string;
}

export const useLoginWithGoogle = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async ({ googleCredential }: GoogleCredentials): Promise<LoginResponse> => {
         await apiHandler.post(API_ENDPOINTS.AUTH.LOGIN, { googleCredential } as Record<string, unknown>);
         const user = await apiHandler.get(API_ENDPOINTS.AUTH.ME);
         return { user, username: user.username };
      },
      onSuccess: (data) => {
         queryClient.setQueryData(authKeys.me(), data.user);
         store.dispatch(setUser(data.user));
      }
   });
};

interface TelegramCredentials {
   telegramAuthData: string;
}

export const useLoginWithTelegram = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async ({ telegramAuthData }: TelegramCredentials): Promise<LoginResponse> => {
         await apiHandler.post(API_ENDPOINTS.AUTH.LOGIN, { telegramAuthData } as Record<string, unknown>);
         const user = await apiHandler.get(API_ENDPOINTS.AUTH.ME);
         return { user, username: user.username };
      },
      onSuccess: (data) => {
         queryClient.setQueryData(authKeys.me(), data.user);
         store.dispatch(setUser(data.user));
      }
   });
};

interface RegisterData {
   username: string;
   password: string;
   email: string;
   isWorldId: string;
}

export const useRegister = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async (data: RegisterData): Promise<LoginResponse> => {
         await apiHandler.post(API_ENDPOINTS.AUTH.REGISTER, data as unknown as Record<string, unknown>);
         const user = await apiHandler.get(API_ENDPOINTS.AUTH.ME);
         return { user, username: data.username };
      },
      onSuccess: (data) => {
         queryClient.setQueryData(authKeys.me(), data.user);
         store.dispatch(setUser(data.user));
      }
   });
};

export const useRegisterWithGoogle = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async ({ googleCredential }: GoogleCredentials): Promise<LoginResponse> => {
         await apiHandler.post(API_ENDPOINTS.AUTH.REGISTER, { googleCredential } as Record<string, unknown>);
         const user = await apiHandler.get(API_ENDPOINTS.AUTH.ME);
         return { user, username: user.username };
      },
      onSuccess: (data) => {
         queryClient.setQueryData(authKeys.me(), data.user);
         store.dispatch(setUser(data.user));
      }
   });
};

export const useRegisterWithTelegram = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async ({ telegramAuthData }: TelegramCredentials): Promise<LoginResponse> => {
         await apiHandler.post(API_ENDPOINTS.AUTH.REGISTER, { telegramAuthData } as Record<string, unknown>);
         const user = await apiHandler.get(API_ENDPOINTS.AUTH.ME);
         return { user, username: user.username };
      },
      onSuccess: (data) => {
         queryClient.setQueryData(authKeys.me(), data.user);
         store.dispatch(setUser(data.user));
      }
   });
};

interface UpdateUserData {
   username?: string;
   password?: string;
   email?: string;
   telegramUsername?: string;
   walletAddress?: string;
}

export const useUpdateUser = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async (data: UpdateUserData): Promise<User> => {
         const response = await apiHandler.post(API_ENDPOINTS.AUTH.UPDATE, data as Record<string, unknown>);
         return response.user || response;
      },
      onSuccess: (user) => {
         queryClient.setQueryData(authKeys.me(), user);
         store.dispatch(setUser(user));
      }
   });
};

export const useLogout = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async (): Promise<void> => {
         await apiHandler.post(API_ENDPOINTS.AUTH.LOGOUT);
      },
      onSuccess: () => {
         clearAuthCookieClient();
         queryClient.clear();
         store.dispatch(clearAuth());
      }
   });
};
