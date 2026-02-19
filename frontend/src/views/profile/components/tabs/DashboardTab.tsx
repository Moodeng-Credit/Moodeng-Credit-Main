

import BorrowerDashboardTab from '@/views/profile/components/tabs/BorrowerDashboardTab';

interface DashboardTabProps {
   onPayLoansNow?: () => void;
}

const DashboardTab = ({ onPayLoansNow }: DashboardTabProps) => {
   return (
      <section>
         <BorrowerDashboardTab onPayLoansNow={onPayLoansNow} />
      </section>
   );
};

export default DashboardTab;

