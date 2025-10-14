'use client';

import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';

import Image from 'next/image';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useDispatch, useSelector } from 'react-redux';

import Card from '@/components/board/Card';
import WorldIDVerificationStatus from '@/components/worldId/WorldIDVerificationStatus';

import { fetchUser, updateUser } from '@/store/slices/authSlice';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';

export default function Dash() {
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth);
   const gloanRequests = useSelector((state: RootState) => state.loans.loans.gloans);
   const months = [
      '',
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
   ];
   const [telegramUsername, setTelegramUsername] = useState('');
   const [password, setPassword] = useState('');
   const [username, setUsername] = useState('');
   const [email, setEmail] = useState('');
   const [vip, setVip] = useState(true);
   const [pop, setPop] = useState(false);
   const [navItems, setNavItems] = useState([
      { label: 'Dashboard', active: true },
      { label: 'Loan Summary', active: false },
      { label: 'Transaction History', active: false },
      { label: 'Settings', active: false }
   ]);

   useEffect(() => {
      const Info = async () => {
         await dispatch(fetchUser())
            .unwrap()
            .then(() => {
               console.log('User fetched successfully');
            })
            .catch((error: Error) => {
               console.error('Error fetching user:', error.message || error);
            });
      };
      Info();
   }, [dispatch]);

   useEffect(() => {
      const usernameToFetch = user.username;
      const Loan = async () => {
         await dispatch(getUserLoans(usernameToFetch || ''))
            .unwrap()
            .then(() => {
               console.log('Loan fetched successfully');
            })
            .catch((error: Error) => {
               console.error('Error fetching loan:', error.message || error);
            });
      };
      Loan();
   }, [dispatch, user.username]);

   const handleUpdate = async () => {
      telegramUsername && setPop(true);
      const data = {
         username: !username ? user.username || '' : username,
         email: !email ? user.user?.email : email,
         telegramUsername: !telegramUsername ? user.user?.telegramUsername : telegramUsername,
         password: password
      };
      await dispatch(updateUser(data))
         .unwrap()
         .then(() => {
            console.log('User updated successfully');
         })
         .catch((error: Error) => {
            console.error('Error updating user:', error.message || error);
         });
      setTelegramUsername('');
      setPassword('');
      setUsername('');
      setEmail('');
   };

   const handleRevert = async () => {
      setTelegramUsername('');
      setPassword('');
      setUsername('');
      setEmail('');
   };

   const handleSort = (label: string) => {
      setNavItems((prevItems) =>
         prevItems.map((item) => ({
            ...item,
            active: item.label === label
         }))
      );
   };

   return (
      <div className="bg-[#c9d5f9] min-h-screen flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>
         <main className="flex flex-1 overflow-hidden">
            <aside className="bg-[#b9c8f9] w-56 flex flex-col justify-between select-none">
               <nav className="pt-10 px-6 space-y-6">
                  <ul className="space-y-4">
                     {navItems.map((item) => (
                        <li key={item.label}>
                           <a
                              href="#"
                              key={item.label}
                              onClick={() => handleSort(item.label)}
                              className={`flex items-center space-x-3 font-semibold text-xs leading-4 ${
                                 item.active ? 'text-white bg-[#1D4ED8] rounded-md py-2 px-3' : 'text-[#1D4ED8]'
                              }`}
                           >
                              <div className={!item.active ? 'bg-white p-2 rounded' : ''}>
                                 <i className={`fas fa-credit-card text-sm ${item.active ? 'text-white' : 'text-[#1D4ED8]'}`}></i>
                              </div>
                              <span>{item.label}</span>
                           </a>
                        </li>
                     ))}
                  </ul>
                  <div className="mt-10">
                     <p className="text-[#1D4ED8] font-semibold text-xs leading-4 mb-4">Information</p>
                     <ul className="space-y-4">
                        <li>
                           <a className="flex items-center space-x-3 text-[#1D4ED8] font-semibold text-xs leading-4" href="#">
                              <div className="bg-white p-2 rounded">
                                 <i className="fas fa-user text-[#1D4ED8] text-sm"></i>
                              </div>
                              <span>FAQ</span>
                           </a>
                        </li>
                        <li>
                           <a className="flex items-center space-x-3 text-[#1D4ED8] font-semibold text-xs leading-4" href="#">
                              <div className="bg-white p-2 rounded">
                                 <i className="fas fa-credit-card text-[#1D4ED8] text-sm"></i>
                              </div>
                              <span>Support</span>
                           </a>
                        </li>
                     </ul>
                     <a className="block mt-6 text-[#1D4ED8] font-semibold text-xs leading-4" href="#">
                        View more
                     </a>
                  </div>
               </nav>
               <div className="relative">
                  <Image
                     alt="hippo"
                     className="max-w-none w-64 object-contain"
                     draggable="false"
                     height="256"
                     src="/board-image.png"
                     width="256"
                  />
               </div>
            </aside>
            <section className="flex-1 p-8 overflow-auto">
               {!navItems[3].active ? (
                  <div className="flex justify-end space-x-2 mb-6">
                     <button
                        onClick={() => setVip(false)}
                        className={(!vip ? 'bg-white text-[#2a56f4]' : 'bg-[#a7b9f9] text-white') + ' font-semibold rounded-md px-6 py-2'}
                        type="button"
                     >
                        Borrower
                     </button>
                     <button
                        onClick={() => setVip(true)}
                        className={(vip ? 'bg-white text-[#2a56f4]' : 'bg-[#a7b9f9] text-white') + ' font-semibold rounded-md px-6 py-2'}
                        type="button"
                     >
                        Lender
                     </button>
                  </div>
               ) : null}
               {navItems[1].active || navItems[2].active ? (
                  <div className="flex justify-between items-center mb-4">
                     <button
                        className="border border-[#2a56f4] text-[#2a56f4] font-semibold text-xs rounded-md px-4 py-2 flex items-center space-x-1"
                        type="button"
                     >
                        <span>ALL {vip ? 'FUNDINGS' : 'LOANS'}</span>
                        <i className="fas fa-filter text-xs"></i>
                     </button>
                     <button
                        className="border border-[#6b7280] text-[#6b7280] text-xs rounded-md px-4 py-2 flex items-center space-x-2"
                        type="button"
                     >
                        <i className="fas fa-search"></i>
                        <span>SEARCH {vip ? 'FUNDINGS' : 'LOANS'}</span>
                     </button>
                  </div>
               ) : null}
               <div className="overflow-x-auto">
                  {navItems[0].active ? <div className=""></div> : null}
                  {navItems[1].active ? (
                     <div className="flex flex-wrap justify-center gap-8 overflow-hidden">
                        {gloanRequests
                           .filter((loan) => (vip ? loan.lenderUser === user.username : loan.borrowerUser === user.username))
                           .map((loan) => (
                              <Card key={loan._id} type={vip} loan={loan} />
                           ))}
                     </div>
                  ) : null}
                  {navItems[2].active ? (
                     <table className="w-full border-collapse rounded-lg overflow-hidden">
                        <tbody className="Table">
                           <tr className="text-[10px] text-[#1f2937] font-semibold">
                              <td className="px-4 py-3 font-bold text-left">All Transaction</td>
                              <td className="px-4 py-3 font-bold text-left">{vip ? 'Funded' : 'Borrowed'} Amount</td>
                              <td className="px-4 py-3 font-bold text-left">Date {vip ? 'Funded' : 'Borrowed'}</td>
                              <td className="px-4 py-3 font-bold text-left">Returned Amount</td>
                              <td className="px-4 py-3 font-bold text-left">Date Returned</td>
                              <td className="px-4 py-3 font-bold text-left">{vip ? "Borrower's" : "Lender's"} Name</td>
                              <td className="px-4 py-3 font-bold text-left">Status</td>
                           </tr>
                           {gloanRequests
                              .filter((loan) => (vip ? loan.lenderUser === user.username : loan.borrowerUser === user.username))
                              .map((loan) => (
                                 <tr className="text-[10px] text-[#2a56f4] font-semibold" key={loan._id}>
                                    <td className="px-4 py-3 font-bold text-left text-[#2a56f4]">{loan.reason}</td>
                                    <td className="px-4 py-3 font-bold text-left text-[#166534]">${loan.loanAmount}.00</td>
                                    <td className="px-4 py-3 font-bold text-left text-[#2a56f4]">
                                       {months[parseInt(loan.createdAt.split('T')[0].split('-')[1])] +
                                          ' ' +
                                          loan.createdAt.split('T')[0].split('-')[2] +
                                          ', ' +
                                          loan.createdAt.split('T')[0].split('-')[0]}
                                    </td>
                                    <td className="px-4 py-3 font-bold text-left text-[#b91c1c]">${loan.repaymentAmount}.00</td>
                                    <td className="px-4 py-3 font-bold text-left text-[#2a56f4]">
                                       {months[parseInt(loan.updatedAt.split('T')[0].split('-')[1])] +
                                          ' ' +
                                          loan.updatedAt.split('T')[0].split('-')[2] +
                                          ', ' +
                                          loan.updatedAt.split('T')[0].split('-')[0]}
                                    </td>
                                    <td className="px-4 py-3 font-bold text-left text-[#2a56f4]">
                                       {vip ? loan.borrowerUser : loan.lenderUser}
                                    </td>
                                    <td
                                       className={
                                          'px-4 py-3 font-bold text-left' +
                                          (loan.repaymentStatus === 'Paid'
                                             ? ' text-[#166534]'
                                             : loan.repaymentStatus === 'Unpaid'
                                               ? ' text-[#b91c1c]'
                                               : '')
                                       }
                                    >
                                       {loan.loanStatus + ', ' + loan.repaymentStatus}
                                    </td>
                                 </tr>
                              ))}
                        </tbody>
                     </table>
                  ) : null}
                  {navItems[3].active ? (
                     <div className="flex items-center justify-center p-6">
                        <main className="bg-white rounded-md w-full max-w-5xl p-8 relative grid gap-8 z-[0]">
                           <div className="absolute -top-5 left-0 bg-white rounded-md px-4 py-2">
                              <h1 className="text-[#0a1a5f] font-semibold text-base leading-5 select-none">Account Settings</h1>
                           </div>
                           <div className="flex justify-end gap-3">
                              <button
                                 type="button"
                                 onClick={handleRevert}
                                 className="text-[#f44336] border border-[#f44336] rounded px-3 py-1 text-[10px] font-normal leading-[12px] hover:bg-[#f44336] hover:text-white transition"
                              >
                                 Revert Changes
                              </button>
                              <button
                                 type="submit"
                                 onClick={handleUpdate}
                                 className="bg-[#1e40af] text-white rounded px-4 py-1 text-[10px] font-semibold leading-[12px] hover:bg-[#1e3a8a] transition"
                              >
                                 Save Changes
                              </button>
                           </div>
                           <form className="flex flex-col md:flex-row gap-8">
                              <div className="flex flex-col gap-16 w-full md:w-1/3 text-[10px] text-[#4a4a4a] font-normal leading-[12px]">
                                 <section>
                                    <h2 className="font-semibold text-[12px] text-[#0a1a5f] mb-2 select-none">Profile</h2>
                                    <p className="mb-1">
                                       Having an up-to-date email address attached to your account is a great step towards improving account
                                       security.
                                    </p>
                                    <p>
                                       You can also opt to receive notifications via Telegram or WhatsApp to stay informed of any account
                                       changes.
                                    </p>
                                 </section>
                              </div>
                              <div className="flex flex-col w-full md:w-2/3 space-y-6 text-[10px] text-[#4a4a4a] font-normal leading-[12px]">
                                 <div className="grid grid-cols-12 items-center gap-3">
                                    <label
                                       htmlFor="username"
                                       className="col-span-3 text-[#0a1a5f] font-semibold text-[10px] leading-[12px] select-none"
                                    >
                                       Username
                                    </label>
                                    <input
                                       id="username"
                                       type="text"
                                       placeholder={user.username || ''}
                                       value={username}
                                       onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                                       className="col-span-6 bg-[#e0e7ff] rounded px-2 py-1 text-[#3b82f6] text-[10px] font-normal leading-[12px] outline-none"
                                    />
                                    <button
                                       type="button"
                                       onClick={handleUpdate}
                                       className="col-span-3 bg-[#1e40af] text-white rounded px-3 py-1 text-[10px] font-semibold leading-[12px] hover:bg-[#1e3a8a] transition"
                                    >
                                       Change Username
                                    </button>
                                 </div>
                                 <div className="grid grid-cols-12 items-center gap-3">
                                    <label
                                       htmlFor="email"
                                       className="col-span-3 text-[#0a1a5f] font-semibold text-[10px] leading-[12px] select-none"
                                    >
                                       Email
                                    </label>
                                    <input
                                       id="email"
                                       type="email"
                                       placeholder={user.user?.email || ''}
                                       value={email}
                                       onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                                       className="col-span-6 bg-[#e0e7ff] rounded px-2 py-1 text-[#3b82f6] text-[10px] font-normal leading-[12px] outline-none"
                                    />
                                    <button
                                       type="button"
                                       onClick={handleUpdate}
                                       className="col-span-3 bg-[#1e40af] text-white rounded px-3 py-1 text-[10px] font-semibold leading-[12px] hover:bg-[#1e3a8a] transition"
                                    >
                                       Change Email
                                    </button>
                                 </div>
                                 <div className="grid grid-cols-12 items-center gap-3">
                                    <div className="col-span-3">
                                       <label className="text-[#0a1a5f] font-semibold text-[10px] leading-[12px] select-none block">
                                          Telegram
                                       </label>
                                       <p className="text-[8px] text-[#4a4a4a] font-normal leading-[10px] mt-1">
                                          Connect your telegram to get the latest updates
                                       </p>
                                    </div>
                                    <input
                                       id="telegram"
                                       type="text"
                                       placeholder={user.user?.telegramUsername || ''}
                                       value={telegramUsername}
                                       onChange={(e: ChangeEvent<HTMLInputElement>) => setTelegramUsername(e.target.value)}
                                       className="col-span-6 bg-[#e0e7ff] rounded px-2 py-1 text-[#3b82f6] text-[10px] font-normal leading-[12px] outline-none"
                                    />
                                    <button
                                       type="button"
                                       onClick={handleUpdate}
                                       className="col-span-3 bg-[#1e40af] text-white rounded px-3 py-1 text-[10px] font-semibold leading-[12px] hover:bg-[#1e3a8a] transition"
                                    >
                                       {user.user?.telegramUsername ? 'Update' : 'Connect'}
                                    </button>
                                 </div>
                                 <div className="grid grid-cols-12 gap-3">
                                    <div className="col-span-3">
                                       <label className="text-[#0a1a5f] font-semibold text-[10px] leading-[12px] select-none block">
                                          Whatsapp
                                       </label>
                                       <p className="text-[8px] text-[#4a4a4a] font-normal leading-[10px] mt-1">
                                          Connect your WhatsApp to get the latest updates
                                       </p>
                                    </div>
                                    <div className="col-span-6">
                                       <button
                                          type="button"
                                          className="bg-[#1e40af] text-white rounded px-3 py-1 text-[10px] font-semibold leading-[12px] w-full hover:bg-[#1e3a8a] transition"
                                       >
                                          Connect Account
                                       </button>
                                    </div>
                                 </div>
                              </div>
                           </form>
                           <form className="flex flex-col md:flex-row gap-8">
                              <div className="flex flex-col gap-16 w-full md:w-1/3 text-[10px] text-[#4a4a4a] font-normal leading-[12px]">
                                 <section>
                                    <h2 className="font-semibold text-[12px] text-[#0a1a5f] mb-2 select-none">Security</h2>
                                    <p>This information will be shown publicly so be careful what information you provide</p>
                                 </section>
                              </div>
                              <div className="flex flex-col w-full md:w-2/3 space-y-6 text-[10px] text-[#4a4a4a] font-normal leading-[12px]">
                                 <div className="grid grid-cols-12 items-center gap-3">
                                    <label className="col-span-3 text-[#0a1a5f] font-semibold text-[10px] leading-[12px] select-none">
                                       Password
                                    </label>
                                    <input
                                       id="password"
                                       type="password"
                                       placeholder="New Password"
                                       value={password}
                                       onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                                       className="col-span-6 bg-[#e0e7ff] rounded px-2 py-1 text-[#3b82f6] text-[10px] font-normal leading-[12px] outline-none"
                                    />
                                    <button
                                       type="button"
                                       onClick={handleUpdate}
                                       className="col-span-3 bg-[#1e40af] text-white rounded px-3 py-1 text-[10px] font-semibold leading-[12px] hover:bg-[#1e3a8a] transition"
                                    >
                                       Change Password
                                    </button>
                                 </div>
                                 <div className="grid grid-cols-12 items-center gap-3">
                                    <label
                                       htmlFor="wallet"
                                       className="col-span-3 text-[#0a1a5f] font-semibold text-[10px] leading-[12px] select-none"
                                    >
                                       Wallet
                                    </label>
                                    <input
                                       id="wallet"
                                       type="text"
                                       value={user.user?.walletAddress || ''}
                                       placeholder={user.user?.walletAddress || ''}
                                       disabled
                                       className="col-span-6 bg-[#e0e7ff] rounded px-2 py-1 text-[#4a4a4a] text-[10px] font-normal leading-[12px] outline-none"
                                    />
                                    <div className="col-span-3">
                                       <ConnectButton />
                                    </div>
                                 </div>
                                 <WorldIDVerificationStatus />
                              </div>
                           </form>
                           <form className="flex flex-col md:flex-row gap-8">
                              <div className="flex flex-col gap-16 w-full md:w-1/3 text-[10px] text-[#4a4a4a] font-normal leading-[12px]">
                                 <section>
                                    <h2 className="font-semibold text-[12px] text-[#0a1a5f] mb-2 select-none">Notification</h2>
                                    <p>
                                       Get notified of activity going on with your account. Notifications will be sent to the email that you
                                       have provided.
                                    </p>
                                 </section>
                              </div>
                              <div className="flex flex-col w-full md:w-2/3 space-y-6 text-[10px] text-[#4a4a4a] font-normal leading-[12px]">
                                 <div className="flex flex-col gap-1">
                                    <label className="flex items-center gap-2 text-[10px] font-semibold text-[#0a1a5f] leading-[12px] select-none">
                                       <input
                                          type="checkbox"
                                          className="w-3 h-3 text-[#1e40af] bg-gray-100 border-gray-300 rounded focus:ring-[#1e40af] focus:ring-1"
                                       />
                                       Account Activity
                                    </label>
                                    <p className="text-[8px] text-[#4a4a4a] font-normal leading-[10px] ml-5">
                                       Get important notifications about you or activity you've missed
                                    </p>

                                    <label className="flex items-center gap-2 text-[10px] font-semibold text-[#0a1a5f] leading-[12px] select-none">
                                       <input
                                          type="checkbox"
                                          className="w-3 h-3 text-[#1e40af] bg-gray-100 border-gray-300 rounded focus:ring-[#1e40af] focus:ring-1"
                                       />
                                       Transaction Activity
                                    </label>
                                    <p className="text-[8px] text-[#4a4a4a] font-normal leading-[10px] ml-5">
                                       Get important notifications about you or activity you've missed
                                    </p>

                                    <label className="flex items-center gap-2 text-[10px] font-semibold text-[#0a1a5f] leading-[12px] select-none">
                                       <input
                                          type="checkbox"
                                          className="w-3 h-3 text-[#1e40af] bg-gray-100 border-gray-300 rounded focus:ring-[#1e40af] focus:ring-1"
                                       />
                                       Moodeng Blogs
                                    </label>
                                    <p className="text-[8px] text-[#4a4a4a] font-normal leading-[10px] ml-5">
                                       Get important notifications about you or activity you've missed
                                    </p>
                                 </div>
                              </div>
                           </form>
                        </main>
                     </div>
                  ) : null}
               </div>
               {navItems[1].active || navItems[2].active ? (
                  <div className="flex justify-center mt-8">
                     <button className="bg-[#2a56f4] text-white font-semibold rounded-md px-20 py-3" type="button">
                        Load More...
                     </button>
                  </div>
               ) : null}
               {pop ? (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                     <button onClick={() => setPop(false)} className="text-gray-600 hover:text-gray-800 fixed top-4 right-4 z-50">
                        ✖
                     </button>
                     <main className="flex flex-col py-7 w-full bg-white rounded-3xl border border-solid border-neutral-200 shadow-[0px_2px_8px_rgba(0,0,0,0.25)] flex overflow-hidden flex-col py-5 bg-white rounded-2xl max-w-[473px]">
                        <section className="flex flex-col px-5 w-full">
                           <h1 className="self-start text-2xl font-medium leading-none text-black">Telegram</h1>
                           <p className="mt-5 text-sm leading-6 text-gray-500 text-opacity-60">Connect Telegram.</p>
                           <div className="self-end">
                              <button
                                 onClick={() => setPop(false)}
                                 className="mt-5 mr-2 overflow-hidden flex-auto gap-5 self-stretch px-5 py-3.5 rounded-lg min-h-[46px] bg-white text-black border border-solid"
                              >
                                 Cancel
                              </button>
                              <button
                                 onClick={() => window.open('https://t.me/BegfiBot', '_blank')}
                                 className="overflow-hidden flex-auto gap-5 self-stretch px-5 py-3.5 rounded-lg min-h-[46px] bg-blue-500 text-white border border-solid"
                              >
                                 Connect
                              </button>
                           </div>
                        </section>
                     </main>
                  </div>
               ) : null}
            </section>
         </main>
      </div>
   );
}
