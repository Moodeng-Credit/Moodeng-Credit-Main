import { useEffect } from 'react';

import { useDispatch, useSelector } from 'react-redux';

import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

export const useProfileData = () => {
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth);

   useEffect(() => {
      const fetchUserData = async () => {
         await dispatch(fetchUser())
            .unwrap()
            .then(() => {
               console.log('User fetched successfully');
            })
            .catch((error: Error) => {
               console.error('Error fetching user:', error.message || error);
            });
      };
      fetchUserData();
   }, [dispatch]);

   return { user };
};
