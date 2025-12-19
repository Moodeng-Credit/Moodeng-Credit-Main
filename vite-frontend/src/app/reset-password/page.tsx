import { useEffect, useState } from 'react';

import { useNavigate, useSearchParams } from 'react-router-dom';

export default function ResetPasswordPage() {
   const [password, setPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');
   const [message, setMessage] = useState('');
   const [error, setError] = useState('');
   const [loading, setLoading] = useState(false);
   const [token, setToken] = useState<string | null>(null);
   const navigate = useNavigate();
   const [searchParams] = useSearchParams();

   useEffect(() => {
      const tokenParam = searchParams.get('token');
      if (tokenParam) {
         setToken(tokenParam);
      } else {
         setError('Invalid reset link. Please request a new password reset.');
      }
   }, [searchParams]);

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setMessage('');
      setError('');

      if (password !== confirmPassword) {
         setError('Passwords do not match');
         return;
      }

      if (password.length < 6) {
         setError('Password must be at least 6 characters long');
         return;
      }

      if (!token) {
         setError('Invalid reset link');
         return;
      }

      setLoading(true);

      try {
         const response = await fetch(import.meta.env.VITE_API_URL + '/auth/reset-password', {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token, password })
         });

         const data = await response.json();

         if (response.ok) {
            setMessage(data.message || 'Password reset successful! Redirecting to login...');
            setTimeout(() => {
               navigate('/login');
            }, 2000);
         } else {
            setError(data.message || 'Failed to reset password. Please try again.');
         }
      } catch {
         setError('An error occurred. Please try again.');
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
         <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-lg shadow-md">
            <div>
               <h2 className="text-center text-3xl font-bold text-gray-900">Set New Password</h2>
               <p className="mt-2 text-center text-sm text-gray-600">Please enter your new password below.</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
               <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                     New Password
                  </label>
                  <input
                     id="password"
                     name="password"
                     type="password"
                     required
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                     placeholder="Enter new password"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                     Password must be at least 6 characters long and can only include letters, numbers, and the symbols !@#$%^&*()+=._-
                  </p>
               </div>

               <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                     Confirm New Password
                  </label>
                  <input
                     id="confirmPassword"
                     name="confirmPassword"
                     type="password"
                     required
                     value={confirmPassword}
                     onChange={(e) => setConfirmPassword(e.target.value)}
                     className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                     placeholder="Confirm new password"
                  />
               </div>

               {message ? (
                  <div className="rounded-md bg-green-50 p-4">
                     <p className="text-sm text-green-800">{message}</p>
                  </div>
               ) : null}

               {error ? (
                  <div className="rounded-md bg-red-50 p-4">
                     <p className="text-sm text-red-800">{error}</p>
                  </div>
               ) : null}

               <div>
                  <button
                     type="submit"
                     disabled={loading || !token}
                     className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
               </div>

               <div className="text-center">
                  <button type="button" onClick={() => navigate('/login')} className="text-sm text-blue-600 hover:underline">
                     Back to Login
                  </button>
               </div>
            </form>
         </div>
      </div>
   );
}
