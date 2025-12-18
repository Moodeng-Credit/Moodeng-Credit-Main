export const LOAN_AMOUNTS = [150, 80, 40, 15] as const;

export const NETWORKS = [
   { value: 'solana', label: 'Solana' },
   { value: 'optimism', label: 'OP' },
   { value: 'arbitrum', label: 'Arb' },
   { value: 'polygon', label: 'Polygon' },
   { value: 'base', label: 'Base' },
   { value: 'binance', label: 'Binance' }
] as const;

export const REPAYMENT_RATES = [
   { value: '2.5', label: '0% to 5%', range: [0, 5] },
   { value: '7.5', label: '5% to 10%', range: [5, 10] },
   { value: '15', label: '10% to 20%', range: [10, 20] },
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
