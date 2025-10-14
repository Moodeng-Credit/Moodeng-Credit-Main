'use client';

import { type FormEvent, useState } from 'react';

import { useRouter } from 'next/navigation';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useDispatch } from 'react-redux';
import { useAccount } from 'wagmi';

import Loading from '@/components/Loading';

import { loginUser, registerUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';

export default function Log() {
   const router = useRouter();
   const dispatch = useDispatch<AppDispatch>();
   const account = useAccount();
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [confirm, setConfirm] = useState('');
   const [username, setUsername] = useState('');
   const [network, setNetwork] = useState('');
   const [startOption, setStartOption] = useState('');
   const [isLoading, setIsLoading] = useState(false);
   const [showUser, setShowUser] = useState(false);
   const [showPass, setShowPass] = useState(false);
   const [showEmail, setShowEmail] = useState(false);
   const [showWallet, setShowWallet] = useState(false);
   const [showConfirm, setShowConfirm] = useState(false);
   const [showAccount, setShowAccount] = useState(false);
   const [showLog, setShowLog] = useState(true);
   const walletAddress = account.isConnected && account.address;
   const isWorldId = 'INACTIVE';

   const clear = () => {
      setEmail('');
      setPassword('');
      setConfirm('');
      setUsername('');
      setNetwork('');
      setStartOption('');
   };

   const clearShow = () => {
      setShowUser(false);
      setShowPass(false);
      setShowEmail(false);
      setShowConfirm(false);
      setShowAccount(false);
      setShowWallet(false);
   };

   const handleRegister = async (e: FormEvent<HTMLFormElement>) => {
      setShowConfirm(false);
      e.preventDefault();
      clearShow();
      if (password !== confirm) {
         setShowConfirm(true);
      }
      if (username && walletAddress && isWorldId && password && email && password === confirm) {
         setIsLoading(true);
         const resultAction = await dispatch(registerUser({ username, walletAddress, isWorldId, password, email }));
         console.log(resultAction);
         if (registerUser.fulfilled.match(resultAction)) {
            clear();
            router.push('/dashboard');
         } else {
            const cdt = (resultAction.payload as Record<string, string>)?.message || resultAction.error?.message || 'Registration failed';
            console.log(cdt);
            if (cdt.includes('User')) setShowUser(true);
            if (cdt.includes('Email')) setShowEmail(true);
            if (cdt.includes('Wallet')) setShowWallet(true);
            if (cdt.includes('Password')) setShowPass(true);
            /* alert(resultAction.payload.message); */
         }
         setIsLoading(false);
      }
   };

   const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      clearShow();
      if (username && password) {
         setIsLoading(true);
         const resultAction = await dispatch(loginUser({ username, password }));
         if (loginUser.fulfilled.match(resultAction)) {
            clear();
            router.push('/dashboard');
         } else {
            setShowAccount(true);
            /* alert(resultAction.payload.message); */
         }
         setIsLoading(false);
      }
   };

   return (
      <div className="min-h-screen bg-zinc-100 flex flex-col md:flex-row justify-center items-center px-6 py-12 gap-8">
         {isLoading ? (
            <Loading />
         ) : showLog ? (
            <form onSubmit={handleRegister} className="w-full bg-white max-w-md border rounded-2xl shadow p-6 space-y-4">
               <h2 className="text-xl font-semibold text-center text-blue-600">Welcome to Moodeng Credit</h2>

               <div className="flex flex-col md:flex-row justify-center items-center">
                  <ConnectButton />
               </div>
               {showWallet ? <span className="text-rose-600 text-sm">Wallet already exists.</span> : null}

               <div className="flex items-center gap-2 text-gray-400 text-sm justify-center">
                  <hr className="w-1/4 border" />
                  <span>AND</span>
                  <hr className="w-1/4 border" />
               </div>

               <div className="flex">
                  <input
                     required
                     type="email"
                     placeholder="your_email@moodeng.com"
                     className={`w-full border px-3 py-2 rounded-md ${showEmail ? 'border-rose-500' : ''}`}
                     value={email}
                     onChange={(e) => setEmail(e.target.value)}
                  />
                  <button className="bg-white text-blue-600 border border-l-0 px-4 rounded-r-md font-semibold">VERIFY</button>
               </div>
               {showEmail ? <span className="text-rose-600 text-sm">Email already exists.</span> : null}

               <input
                  required
                  type="password"
                  placeholder="Password"
                  className={`w-full border px-3 py-2 rounded-md ${showPass ? 'border-rose-500' : ''}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
               />
               {showPass ? (
                  <span className="text-rose-600 text-sm">
                     Password is weak, Password must be at least 6 characters long and can only include letters, numbers, and the symbols
                     !@#$%^&*()+=._-
                  </span>
               ) : null}

               <input
                  required
                  type="password"
                  placeholder="Confirm Password"
                  className={`w-full border px-3 py-2 rounded-md ${showConfirm ? 'border-rose-500' : ''}`}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
               />
               {showConfirm ? <span className="text-rose-600 text-sm">Passwords do not match.</span> : null}

               <input
                  required
                  type="text"
                  placeholder="@username"
                  className={`w-full border px-3 py-2 rounded-md ${showUser ? 'border-rose-500' : ''}`}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
               />
               {showUser ? <span className="text-rose-600 text-sm">User already exists.</span> : null}

               <div>
                  <label className="block text-sm text-gray-600 mb-1">Set Default Network</label>
                  <select className="w-full border px-3 py-2 rounded-md" value={network} onChange={(e) => setNetwork(e.target.value)}>
                     <option>Choose Default Network</option>
                     <option>arbitrum</option>
                     <option>optimism</option>
                     <option>polygon</option>
                     <option>bsc</option>
                     <option>sepolia</option>
                     <option>base</option>
                     <option>base sepolia</option>
                  </select>
               </div>

               <div>
                  <label className="block text-sm text-gray-600 mb-1">Where do you want to start?</label>
                  <select
                     className="w-full border px-3 py-2 rounded-md"
                     value={startOption}
                     onChange={(e) => setStartOption(e.target.value)}
                  >
                     <option>Lending or Borrowing</option>
                     <option>Lending</option>
                     <option>Borrowing</option>
                  </select>
               </div>

               <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">
                  Register
               </button>

               <p className="text-center text-sm text-gray-400">
                  Already have an account?{' '}
                  <a onClick={() => setShowLog(!showLog)} href="#login" className="text-blue-600 font-semibold hover:underline">
                     Log In Here
                  </a>
               </p>

               <p className="text-center text-sm text-gray-400">Terms × Privacy × Docs</p>
            </form>
         ) : (
            <form onSubmit={handleLogin} className="w-full bg-white max-w-md border rounded-2xl shadow p-6 space-y-5">
               <h2 className="text-xl font-semibold text-center text-blue-600">Welcome to Moodeng Credit</h2>

               <div className="flex flex-col md:flex-row justify-center items-center">
                  <ConnectButton />
               </div>

               <div className="flex items-center gap-2 text-gray-400 text-sm justify-center">
                  <hr className="w-1/4 border" />
                  <span>OR</span>
                  <hr className="w-1/4 border" />
               </div>

               <input
                  required
                  type="text"
                  placeholder="@username"
                  className={`w-full border px-3 py-2 rounded-md ${showAccount ? 'border-rose-500' : ''}`}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
               />
               {showAccount ? <span className="text-rose-600 text-sm">Invalid credentials.</span> : null}

               <input
                  required
                  type="password"
                  placeholder="Password"
                  className={`w-full border px-3 py-2 rounded-md ${showAccount ? 'border-rose-500' : ''}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
               />
               {showAccount ? <span className="text-rose-600 text-sm">Invalid credentials.</span> : null}

               <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition">
                  Login
               </button>

               <p className="text-center text-sm text-gray-400">
                  Dont have an account?{' '}
                  <a onClick={() => setShowLog(!showLog)} href="#register" className="text-blue-600 font-semibold hover:underline">
                     Sign Up Here
                  </a>
               </p>

               <p className="text-center text-sm text-gray-400">Terms × Privacy × Docs</p>
            </form>
         )}
      </div>
   );
}
