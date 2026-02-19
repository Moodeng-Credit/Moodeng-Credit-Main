import { useEffect } from 'react';

import { useDispatch } from 'react-redux';

import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';

interface UseUserProfileOptions {
   enabled?: boolean;
}

/**
 * Custom hook to fetch current user profile data
 * Consolidates duplicate user profile fetching logic across components
 * @param options - Configuration object with optional enabled flag
 */
export function useUserProfile({ enabled = true }: UseUserProfileOptions = {}) {
   const dispatch = useDispatch<AppDispatch>();

   useEffect(() => {
      if (!enabled) return;

      const fetchUserProfile = async () => {
         await dispatch(fetchUser())
            .unwrap()
            .then(() => {
               console.log('User fetched successfully');
            })
            .catch((error: Error) => {
               console.error('Error fetching user:', error.message || error);
            });
      };

      fetchUserProfile();
   }, [dispatch, enabled]);
}
