import { useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { edgeFunctions } from '@/lib/supabase/functions';

export default function ForgotPasswordPage() {
   const [email, setEmail] = useState('');
   const [message, setMessage] = useState('');
   const [error, setError] = useState('');
   const [loading, setLoading] = useState(false);
   const navigate = useNavigate();

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setMessage('');
      setError('');
      setLoading(true);

      try {
         const { data, error } = await edgeFunctions.forgotPassword({ email });

         if (error) {
            setError(error || 'Failed to send reset email. Please try again.');
         } else {
            setMessage((data as { message?: string })?.message || 'Password reset email sent! Please check your inbox.');
            setEmail('');
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
               <h2 className="text-center text-3xl font-bold text-gray-900">Reset Your Password</h2>
               <p className="mt-2 text-center text-sm text-gray-600">
                  Enter your email address and we'll send you a link to reset your password.
               </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-6">
               <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                     Email address
                  </label>
                  <input
                     id="email"
                     name="email"
                     type="email"
                     required
                     value={email}
                     onChange={(e) => setEmail(e.target.value)}
                     className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                     placeholder="your@email.com"
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
                     disabled={loading}
                     className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     {loading ? 'Sending...' : 'Send Reset Link'}
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
