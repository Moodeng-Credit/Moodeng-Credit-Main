'use client';

import { type ChangeEvent, type FormEvent, type MouseEvent, useEffect, useMemo, useState } from 'react';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useDispatch, useSelector } from 'react-redux';
import { useAccount } from 'wagmi';

import LoanRequestModal from '@/views/dashboard/components/LoanRequestModal';
import UserCard from '@/views/dashboard/components/UserCard';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import YouTubeVideoLightbox from '@/components/ui/YouTubeVideoLightbox';
import WorldIDVerification from '@/components/worldId/WorldIDVerification';

import { LOAN_AMOUNTS, NETWORKS } from '@/constants/loanOptions';
import { fetchUser } from '@/store/slices/authSlice';
import { createLoan, fetchLoans, getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { filterLoans } from '@/utils/loanFilters';

const CREDIT_LEVELLING_VIDEO_ID = 'gaRjXOd2s2U';

export default function Dashboard() {
   const pathname = usePathname();
   const dispatch = useDispatch<AppDispatch>();
   const account = useAccount();
   const { showToastByConfig } = useToast();

   const [showModal, setShowModal] = useState(false);
   const [showPurple, setShowPurple] = useState(false);
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const showVerify = user?.isWorldId !== 'ACTIVE';
   const rawFloanRequests = useSelector((state: RootState) => state.loans?.loans?.floans);
   const floanRequests = useMemo(() => rawFloanRequests || [], [rawFloanRequests]);
   const [sortedLoans, setSortedLoans] = useState(floanRequests);
   const today = new Date().toISOString().split('T')[0];
   const borrowerUserId = user?.username || '';
   const lenderUserId = '';
   const [loanAmount, setLoanAmount] = useState('');
   const [repayedAmount, setRepayedAmount] = useState('');
   const [block, setBlock] = useState(account?.chain?.name);
   const [coin, setCoin] = useState(block === 'sepolia' ? 'Link' : block === 'base' || block === 'baseSepolia' ? 'USDC' : 'USDT');
   const [reason, setReason] = useState('');
   const [days, setDays] = useState('');
   const [currentNetwork, setCurrentNetwork] = useState('');
   const [amount, setAmount] = useState('');
   const [rate, setRate] = useState('');
   const [sd, setSD] = useState<Date | null>(null);
   const [loanTime, setLoanTime] = useState('');
   const [avg, setAvg] = useState('');
   const [searchLoan, setSearchLoan] = useState('');

   const clear = () => {
      setRepayedAmount('');
      setLoanAmount('');
      setReason('');
      setBlock('');
      setCoin('');
      setDays('');
   };

   const handleDateChange = (e: ChangeEvent<HTMLInputElement>) => {
      const selectedDate = e.target.value;
      if (selectedDate) {
         setSD(new Date(selectedDate));
         setLoanTime(''); // Clear loanTime when a specific date is selected
      } else {
         setSD(null);
         setLoanTime(''); // Also clear loanTime when date is cleared
      }
   };

   const handleLoanTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (value === loanTime) {
         setLoanTime('');
         setSD(null);
      } else {
         setLoanTime(value);
         const currentDate = new Date();
         let targetDate: Date | null = new Date(currentDate);
         targetDate.setDate(currentDate.getDate() + Number(value));

         setSD(targetDate);
      }
   };

   const handleApplyLoanClick = () => {
      if ((user.nal || 0) >= (user.mal || 0)) {
         showToastByConfig('loan_limit_reached');
         return;
      }
      setShowModal(true);
      // showVerify state is already managed by the component state based on user.isWorldId
   };

   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      // Check if user has reached maximum loan limit
      if ((user.nal || 0) >= (user.mal || 0)) {
         console.log('Loan limit reached');
         showToastByConfig('loan_limit_reached');
         return;
      }

      // Check each condition separately
      if (user.isWorldId !== 'ACTIVE') {
         console.log('WorldId status not active');
         showToastByConfig('worldid_required');
         return;
      }

      if (!block || !coin) {
         console.log('currentNetwork or coin not selected');
         showToastByConfig('network_required');
         return;
      }

      if (!loanAmount || parseFloat(loanAmount) <= 0) {
         console.log('Invalid loan amount');
         showToastByConfig('invalid_amount');
         return;
      }

      if (parseFloat(loanAmount) > (user.cs || 0)) {
         console.log('Loan amount exceeds credit score');
         showToastByConfig('amount_exceeds_limit');
         return;
      }

      const loanData = {
         borrowerUserId: borrowerUserId || '',
         lenderUserId,
         loanAmount: parseFloat(loanAmount),
         repayedAmount: parseFloat(repayedAmount),
         block,
         coin,
         reason,
         days: parseInt(days)
      };
      user.isWorldId === 'ACTIVE' &&
         block &&
         coin &&
         (user.nal || 0) < (user.mal || 0) &&
         parseFloat(loanAmount) <= (user.cs || 0) &&
         parseFloat(loanAmount) > 0 &&
         (await dispatch(createLoan(loanData))
            .unwrap()
            .then(async () => {
               clear();
               handlePurple();
               await dispatch(fetchUser())
                  .unwrap()
                  .then(() => {
                     console.log('User fetched successfully');
                  })
                  .catch((error: Error) => {
                     console.error('Error fetching user:', error.message || error);
                  });
            })
            .catch((error: Error) => {
               console.error('Error creating loan:', error.message || error);
            }));
   };

   const handleDays = (e: ChangeEvent<HTMLInputElement>) => {
      const selectedDate = e.target.value;

      const newToday = new Date();
      newToday.setHours(0, 0, 0, 0);

      const date = new Date(selectedDate);
      const timeDifference = date.getTime() - newToday.getTime();
      const differenceInDays = timeDifference / (1000 * 60 * 60 * 24);

      setDays(Math.round(differenceInDays).toString());
   };

   const handlePurple = () => {
      setShowPurple(true);
      setShowModal(false);
   };

   useEffect(() => {
      if (typeof window !== 'undefined' && window.location.hash) {
         const element = document.getElementById(window.location.hash.replace('#', ''));
         if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
         }
      }
   }, [pathname]);

   useEffect(() => {
      const Loan = async () => {
         await dispatch(fetchLoans())
            .unwrap()
            .then(() => {
               console.log('Loan fetched successfully');
            })
            .catch((error: Error) => {
               console.error('Error fetching loan:', error.message || error);
            });
         await dispatch(getUserLoans(username || ''))
            .unwrap()
            .then(() => {
               console.log('Loan fetched successfully');
            })
            .catch((error: Error) => {
               console.error('Error fetching loan:', error.message || error);
            });
      };
      Loan();
   }, [dispatch, username]);

   useEffect(() => {
      const originalLoanRequests = [...floanRequests];
      let sortedLoan = originalLoanRequests;
      const newDate = new Date(sd || '');
      if (isNaN(newDate.getTime())) {
         setSD(null);
         setLoanTime('');
      }
      if (amount && Number(amount) > 0) sortedLoan = sortedLoan.filter((loan) => loan.loanAmount === Number(amount));
      if (rate && Number(rate) > 0)
         sortedLoan = sortedLoan.filter(
            (loan) =>
               Number((loan.repayedAmount * 100) / loan.loanAmount) >= Number(rate) - 2.5 &&
               Number((loan.repayedAmount * 100) / loan.loanAmount) <= Number(rate) + 2.5
         );
      else if (rate === '+') sortedLoan = sortedLoan.filter((loan) => Number((loan.repayedAmount * 100) / loan.loanAmount) > 15);
      if (sd) {
         sortedLoan = sortedLoan.filter((loan) => {
            const createdAt = new Date(loan.createdAt);
            const created = new Date(sd);
            const newToday = new Date();
            createdAt.setHours(0, 0, 0, 0);
            created.setHours(0, 0, 0, 0);
            newToday.setHours(0, 0, 0, 0);
            const timeDifference = newToday.getTime() - createdAt.getTime();
            const Difference = created.getTime() - newToday.getTime();
            const InDays = Math.round(Difference / (1000 * 60 * 60 * 24));
            const differenceInDays = Math.round(loan.days - timeDifference / (1000 * 60 * 60 * 24));
            return Number(differenceInDays) <= Number(InDays);
         });
      } else if (loanTime && Number(loanTime) > 0) {
         sortedLoan = sortedLoan.filter((loan) => {
            const createdAt = new Date(loan.createdAt);
            const newToday = new Date();
            createdAt.setHours(0, 0, 0, 0);
            newToday.setHours(0, 0, 0, 0);
            const timeDifference = newToday.getTime() - createdAt.getTime();
            const differenceInDays = Math.round(loan.days - timeDifference / (1000 * 60 * 60 * 24));
            return Number(differenceInDays) <= Number(loanTime);
         });
      } else if (loanTime === '+') sortedLoan = sortedLoan.filter((loan) => loan.days >= Number(loanTime));
      if (currentNetwork) sortedLoan = sortedLoan.filter((loan) => loan.block === currentNetwork);
      if (searchLoan) sortedLoan = sortedLoan.filter((loan) => loan.borrowerUser?.includes(searchLoan));
      if (avg) {
         sortedLoan = sortedLoan.sort((a, b) => {
            if (avg === 'highest') return b.loanAmount - a.loanAmount;
            if (avg === 'lowest') return a.loanAmount - b.loanAmount;
            if (avg === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (avg === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            return 0;
         });
      }
      setSortedLoans(sortedLoan);
   }, [amount, rate, sd, loanTime, currentNetwork, avg, searchLoan, floanRequests]);

   return (
      <>
         <div id="top" className="bg-white text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>
            <main className="mx-auto px-6 pt-6 pb-20 md:px-20">
               <h1 className="text-xl md:text-2xl font-semibold text-gray-900 mb-1">Request Board for Microloans</h1>
               <p className="text-xs md:text-sm text-gray-700 mb-6">
                  Browse requests posted on Moodeng, or jump right in and get verified to start borrowing.
               </p>
               <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mb-10">
                  <button
                     onClick={handleApplyLoanClick}
                     className="bg-blue-600 text-white text-xs md:text-sm font-semibold px-5 py-2 rounded-md w-full sm:w-auto hover:bg-blue-700 transition"
                  >
                     APPLY LOAN
                  </button>
                  <YouTubeVideoLightbox videoId={CREDIT_LEVELLING_VIDEO_ID} />
               </div>
               {user.isWorldId !== 'ACTIVE' ? (
                  <div className="bg-blue-100 text-blue-900 text-center py-3 px-4 rounded-md mb-6">
                     <span className="text-sm md:text-base font-medium">
                        Interested in Borrowing?{' '}
                        <WorldIDVerification>
                           {({ open }) => (
                              <button
                                 onClick={open}
                                 className="underline font-semibold hover:text-blue-700 bg-transparent border-none cursor-pointer"
                              >
                                 Click Here
                              </button>
                           )}
                        </WorldIDVerification>{' '}
                        and Verify You're a Real Person via{' '}
                        <a href="https://worldcoin.org/" className="underline font-semibold hover:text-blue-700">
                           World ID!
                        </a>
                     </span>
                  </div>
               ) : null}
               <div className="flex flex-col md:flex-row md:space-x-10">
                  <aside className="w-full md:w-64 flex-shrink-0">
                     <h2 className="font-semibold text-gray-900 text-sm mb-4">Filters</h2>
                     <form className="space-y-6 text-xs md:text-sm text-gray-700">
                        <fieldset>
                           <legend className="font-semibold mb-2">Set Lending Limit</legend>
                           <input
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                 e.target.value.toString() === amount ? setAmount('') : setAmount(e.target.value.toString())
                              }
                              className="w-full border border-gray-300 rounded px-2 py-1 mb-3 text-xs md:text-sm"
                              placeholder="Custom amount"
                              type="number"
                           />
                           <div className="space-y-1">
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                    className="form-checkbox text-blue-600"
                                    name="lending-limit"
                                    type="checkbox"
                                    checked={amount === '150'}
                                    value="150"
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                       e.target.value === amount ? setAmount('') : setAmount(e.target.value);
                                    }}
                                 />
                                 <span>$150</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                    className="form-checkbox text-blue-600"
                                    name="lending-limit"
                                    type="checkbox"
                                    checked={amount === '80'}
                                    value="80"
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                       e.target.value === amount ? setAmount('') : setAmount(e.target.value);
                                    }}
                                 />
                                 <span>$80</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                    className="form-checkbox text-blue-600"
                                    name="lending-limit"
                                    type="checkbox"
                                    checked={amount === '40'}
                                    value="40"
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                       e.target.value === amount ? setAmount('') : setAmount(e.target.value);
                                    }}
                                 />
                                 <span>$40</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                    className="form-checkbox text-blue-600"
                                    name="lending-limit"
                                    type="checkbox"
                                    checked={amount === '15'}
                                    value="15"
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                       e.target.value === amount ? setAmount('') : setAmount(e.target.value);
                                    }}
                                 />
                                 <span>$15</span>
                              </label>
                           </div>
                        </fieldset>
                        <fieldset>
                           <legend className="font-semibold mb-2">Repayment amount</legend>
                           <input
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                 e.target.value.toString() === rate ? setRate('') : setRate(e.target.value.toString())
                              }
                              className="w-full border border-gray-300 rounded px-2 py-1 mb-3 text-xs md:text-sm"
                              placeholder="Custom amount"
                              type="number"
                           />
                           <div className="space-y-1">
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                    className="form-checkbox text-blue-600"
                                    name="repayment-amount"
                                    type="checkbox"
                                    checked={rate === '2.5'}
                                    value="2.5"
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                       e.target.value === rate ? setRate('') : setRate(e.target.value);
                                    }}
                                 />
                                 <span>0% to 5%</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                    className="form-checkbox text-blue-600"
                                    name="repayment-amount"
                                    type="checkbox"
                                    checked={rate === '7.5'}
                                    value="7.5"
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                       e.target.value === rate ? setRate('') : setRate(e.target.value);
                                    }}
                                 />
                                 <span>5% to 10%</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                    className="form-checkbox text-blue-600"
                                    name="repayment-amount"
                                    type="checkbox"
                                    checked={rate === '12.5'}
                                    value="12.5"
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                       e.target.value === rate ? setRate('') : setRate(e.target.value);
                                    }}
                                 />
                                 <span>10% to 15%</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                    className="form-checkbox text-blue-600"
                                    name="repayment-amount"
                                    type="checkbox"
                                    checked={rate === '+'}
                                    value="+"
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                       e.target.value === rate ? setRate('') : setRate(e.target.value);
                                    }}
                                 />
                                 <span>20%+</span>
                              </label>
                           </div>
                        </fieldset>
                        <fieldset>
                           <legend className="font-semibold mb-2">Repayment Date</legend>
                           <input
                              onChange={handleDateChange}
                              className="w-full border border-gray-300 rounded px-2 py-1 mb-3 text-xs md:text-sm"
                              placeholder="Pick a date..."
                              type="date"
                              min={today}
                              value={sd ? sd?.toISOString().split('T')[0] : ''}
                           />
                           <div className="space-y-1">
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                    className="form-checkbox text-blue-600"
                                    name="repayment-date"
                                    type="checkbox"
                                    checked={loanTime === '7'}
                                    value="7"
                                    onChange={handleLoanTimeChange}
                                 />
                                 <span>Next Week</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                    className="form-checkbox text-blue-600"
                                    name="repayment-date"
                                    type="checkbox"
                                    checked={loanTime === '30'}
                                    value="30"
                                    onChange={handleLoanTimeChange}
                                 />
                                 <span>Next 30 Days</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                    className="form-checkbox text-blue-600"
                                    name="repayment-date"
                                    type="checkbox"
                                    checked={loanTime === '90'}
                                    value="90"
                                    onChange={handleLoanTimeChange}
                                 />
                                 <span>Next 90 Days</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                    className="form-checkbox text-blue-600"
                                    name="repayment-date"
                                    type="checkbox"
                                    checked={loanTime === '120'}
                                    value="120"
                                    onChange={handleLoanTimeChange}
                                 />
                                 <span>Next 120 Days+</span>
                              </label>
                           </div>
                        </fieldset>
                        <fieldset>
                           <legend className="font-semibold mb-2">Borrow Type</legend>
                           <div className="space-y-1 text-xs md:text-sm text-gray-700">
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input className="form-checkbox text-blue-600" name="borrow-type" type="checkbox" value="good-standing" />
                                 <span>Good Standing</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input className="form-checkbox text-blue-600" name="borrow-type" type="checkbox" value="beginner" />
                                 <span>Beginner Borrower</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input className="form-checkbox text-blue-600" name="borrow-type" type="checkbox" value="no-active" />
                                 <span>No Active Loans</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input className="form-checkbox text-blue-600" name="borrow-type" type="checkbox" value="long-term" />
                                 <span>Long Term Loans</span>
                              </label>
                           </div>
                        </fieldset>
                        <fieldset>
                           <legend className="font-semibold mb-2">currentNetwork</legend>
                           <div className="space-y-1 text-xs md:text-sm text-gray-700">
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                    className="form-checkbox text-blue-600"
                                    name="network"
                                    type="checkbox"
                                    checked={currentNetwork === 'optimism'}
                                    value="optimism"
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                       e.target.value === currentNetwork ? setCurrentNetwork('') : setCurrentNetwork(e.target.value);
                                    }}
                                 />
                                 <span>Optimism</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                    className="form-checkbox text-blue-600"
                                    name="network"
                                    type="checkbox"
                                    checked={currentNetwork === 'arbitrum'}
                                    value="arbitrum"
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                       e.target.value === currentNetwork ? setCurrentNetwork('') : setCurrentNetwork(e.target.value);
                                    }}
                                 />
                                 <span>Arbitrum</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                    className="form-checkbox text-blue-600"
                                    name="network"
                                    type="checkbox"
                                    checked={currentNetwork === 'polygon'}
                                    value="polygon"
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                       e.target.value === currentNetwork ? setCurrentNetwork('') : setCurrentNetwork(e.target.value);
                                    }}
                                 />
                                 <span>Polygon</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                    className="form-checkbox text-blue-600"
                                    name="network"
                                    type="checkbox"
                                    checked={currentNetwork === 'base'}
                                    value="base"
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                       e.target.value === currentNetwork ? setCurrentNetwork('') : setCurrentNetwork(e.target.value);
                                    }}
                                 />
                                 <span>Base</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                    className="form-checkbox text-blue-600"
                                    name="network"
                                    type="checkbox"
                                    checked={currentNetwork === 'binance'}
                                    value="binance"
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                       e.target.value === currentNetwork ? setCurrentNetwork('') : setCurrentNetwork(e.target.value);
                                    }}
                                 />
                                 <span>Binance</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                    className="form-checkbox text-blue-600"
                                    name="network"
                                    type="checkbox"
                                    checked={currentNetwork === 'sepolia'}
                                    value="sepolia"
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                       e.target.value === currentNetwork ? setCurrentNetwork('') : setCurrentNetwork(e.target.value);
                                    }}
                                 />
                                 <span>Sepolia</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                 <input
                                    className="form-checkbox text-blue-600"
                                    name="network"
                                    type="checkbox"
                                    checked={currentNetwork === 'baseSepolia'}
                                    value="baseSepolia"
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                       e.target.value === currentNetwork ? setCurrentNetwork('') : setCurrentNetwork(e.target.value);
                                    }}
                                 />
                                 <span>Base Sepolia</span>
                              </label>
                           </div>
                           <p className="text-gray-400 text-[9px] mt-1">More Networks...</p>
                        </fieldset>
                     </form>
                  </aside>
                  <section className="flex-1 flex flex-col items-center mt-10 md:mt-0">
                     <div className="flex flex-wrap justify-start md:justify-end gap-3 mb-6 w-full max-w-xl">
                        <button
                           onClick={(e: MouseEvent<HTMLButtonElement>) => setAvg((e.target as HTMLButtonElement).value)}
                           value="lowest"
                           className="text-[10px] md:text-xs border border-gray-300 rounded px-3 py-1 flex items-center space-x-1 hover:bg-gray-100"
                        >
                           <span>Lowest</span>
                           <i className="fas fa-filter text-gray-600 text-xs"></i>
                        </button>
                        <button
                           onClick={(e: MouseEvent<HTMLButtonElement>) => setAvg((e.target as HTMLButtonElement).value)}
                           value="highest"
                           className="text-[10px] md:text-xs border border-gray-300 rounded px-3 py-1 flex items-center space-x-1 hover:bg-gray-100"
                        >
                           <span>Highest</span>
                           <i className="fas fa-filter text-gray-600 text-xs"></i>
                        </button>
                        <button
                           onClick={(e: MouseEvent<HTMLButtonElement>) => setAvg((e.target as HTMLButtonElement).value)}
                           value="oldest"
                           className="text-[10px] md:text-xs border border-gray-300 rounded px-3 py-1 flex items-center space-x-1 hover:bg-gray-100"
                        >
                           <span>Oldest</span>
                           <i className="fas fa-filter text-gray-600 text-xs"></i>
                        </button>
                        <button
                           onClick={(e: MouseEvent<HTMLButtonElement>) => setAvg((e.target as HTMLButtonElement).value)}
                           value="newest"
                           className="text-[10px] md:text-xs border border-gray-300 rounded px-3 py-1 flex items-center space-x-1 hover:bg-gray-100"
                        >
                           <span>Newest</span>
                           <i className="fas fa-filter text-gray-600 text-xs"></i>
                        </button>
                        <div className="flex-1 min-w-[180px] max-w-xs">
                           <input
                              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchLoan(e.target.value)}
                              className="w-full border border-gray-300 rounded-full px-4 py-1 text-xs md:text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
                              placeholder="Search Request..."
                              type="search"
                           />
                        </div>
                     </div>
                     <div className="flex flex-wrap justify-center gap-6">
                        {sortedLoans && Array.isArray(sortedLoans)
                           ? sortedLoans.map((loan) => <UserCard key={loan._id} {...loan} />)
                           : null}
                     </div>
                     <button className="bg-blue-600 text-white text-xs md:text-sm font-semibold px-10 py-2 mt-6 rounded-md hover:bg-blue-700 transition">
                        Load More...
                     </button>
                  </section>
               </div>
               <Link href="/dashboard#top" className="float-right">
                  <Image
                     src="https://cdn.builder.io/api/v1/image/assets/c9a8899718394d87a40cf9e7196a9f95/e81253cfc6443f8a9fc2246506d2c6496689513b?placeholderIfAbsent=true"
                     className="w-[46px]"
                     alt="Floating action button"
                     width={100}
                     height={100}
                  />
               </Link>
            </main>
         </div>
         <LoanRequestModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            showVerify={showVerify}
            user={user}
            loanAmount={loanAmount}
            setLoanAmount={setLoanAmount}
            repayedAmount={repayedAmount}
            setRepayedAmount={setRepayedAmount}
            reason={reason}
            setReason={setReason}
            days={days}
            today={today}
            handleDays={handleDays}
            handleSubmit={handleSubmit}
         />
         {showPurple ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
               <button onClick={() => setShowPurple(false)} className="text-gray-600 hover:text-gray-800 fixed top-4 right-4 z-50">
                  ✖
               </button>
               <section className="max-w-md mx-auto rounded-lg shadow-md" style={{ minWidth: '320px', aspectRatio: '9 / 16' }}>
                  <div className="w-full h-full rounded-lg bg-gradient-to-tr from-[#7B5FFF] via-[#C55FFF] to-[#D45FFF] flex items-center justify-center">
                     <div
                        aria-hidden="true"
                        className="bg-white rounded-full p-6 flex items-center justify-center"
                        style={{ width: '72px', height: '72px' }}
                     >
                        <i className="fas fa-check text-[#7B5FFF] text-4xl"></i>
                     </div>
                  </div>
               </section>
            </div>
         ) : null}
      </>
   );
}
