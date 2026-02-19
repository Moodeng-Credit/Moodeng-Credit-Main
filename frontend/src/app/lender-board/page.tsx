'use client';

import { useState } from 'react';
import { useSelector } from 'react-redux';

import RequestLoanModal from '@/app/lender-board/components/RequestLoanModal';
import { type RootState } from '@/store/store';

export default function LenderBoard() {
   const [isModalOpen, setIsModalOpen] = useState(false);
   const { user } = useSelector((state: RootState) => state.auth);

   const handleOpenModal = () => {
      setIsModalOpen(true);
   };

   const handleCloseModal = () => {
      setIsModalOpen(false);
   };

   return (
      <div className="min-h-screen bg-gray-50 p-6">
         <div className="max-w-7xl mx-auto">
            <header className="mb-8">
               <h1 className="text-3xl font-bold text-gray-900 mb-2">Lender Board</h1>
               <p className="text-gray-600">View and manage loan requests</p>
            </header>

            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
               <button
                  onClick={handleOpenModal}
                  className="bg-[#1E56FF] text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
               >
                  Request a Loan
               </button>
            </div>

            <div className="grid gap-4">
               <p className="text-gray-500">No loan requests yet. Click "Request a Loan" to get started.</p>
            </div>
         </div>

         <RequestLoanModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            user={user}
         />
      </div>
   );
}
