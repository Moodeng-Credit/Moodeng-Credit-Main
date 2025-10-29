export const LOAN_AMOUNTS = [15, 40, 80, 150] as const;

export const NETWORKS = [
   { value: 'optimism', label: 'Optimism' },
   { value: 'arbitrum', label: 'Arbitrum' },
   { value: 'polygon', label: 'Polygon' },
   { value: 'base', label: 'Base' },
   { value: 'binance', label: 'Binance' },
   { value: 'sepolia', label: 'Sepolia' },
   { value: 'baseSepolia', label: 'Base Sepolia' }
] as const;

export const REPAYMENT_RATES = [
   { value: '2.5', label: '0% to 5%', range: [0, 5] },
   { value: '7.5', label: '5% to 10%', range: [5, 10] },
   { value: '12.5', label: '10% to 15%', range: [10, 15] },
   { value: '+', label: '20%+', range: [20, Infinity] }
] as const;

export const LOAN_TIME_PERIODS = [
   { value: '7', label: 'Next Week' },
   { value: '30', label: 'Next 30 Days' },
   { value: '90', label: 'Next 90 Days' },
   { value: '120', label: 'Next 120 Days+' }
] as const;

export const BORROW_TYPES = [
   { value: 'good-standing', label: 'Good Standing' },
   { value: 'beginner', label: 'Beginner Borrower' },
   { value: 'no-active', label: 'No Active Loans' },
   { value: 'long-term', label: 'Long Term Loans' }
] as const;
