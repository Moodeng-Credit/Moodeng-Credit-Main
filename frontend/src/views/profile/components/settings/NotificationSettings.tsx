interface NotificationOption {
   id: string;
   label: string;
   description: string;
}

const NOTIFICATION_OPTIONS: NotificationOption[] = [
   {
      id: 'account-activity',
      label: 'Account Activity',
      description: "Get important notifications about you or activity you've missed"
   },
   {
      id: 'transaction-activity',
      label: 'Transaction Activity',
      description: "Get important notifications about you or activity you've missed"
   },
   {
      id: 'moodeng-blogs',
      label: 'Moodeng Blogs',
      description: "Get important notifications about you or activity you've missed"
   }
];

export default function NotificationSettings() {
   return (
      <form className="flex flex-col md:flex-row gap-8">
         <div className="flex flex-col gap-16 w-full md:w-1/3 text-[10px] text-[#4a4a4a] font-normal leading-[12px]">
            <section>
               <h2 className="font-semibold text-[12px] text-[#0a1a5f] mb-2 select-none">Notification</h2>
               <p>Get notified of activity going on with your account. Notifications will be sent to the email that you have provided.</p>
            </section>
         </div>
         <div className="flex flex-col w-full md:w-2/3 space-y-6 text-[10px] text-[#4a4a4a] font-normal leading-[12px]">
            <div className="flex flex-col gap-1">
               {NOTIFICATION_OPTIONS.map((option) => (
                  <div key={option.id}>
                     <label className="flex items-center gap-2 text-[10px] font-semibold text-[#0a1a5f] leading-[12px] select-none">
                        <input
                           type="checkbox"
                           className="w-3 h-3 text-[#1e40af] bg-gray-100 border-gray-300 rounded focus:ring-[#1e40af] focus:ring-1"
                        />
                        {option.label}
                     </label>
                     <p className="text-[8px] text-[#4a4a4a] font-normal leading-[10px] ml-5">{option.description}</p>
                  </div>
               ))}
            </div>
         </div>
      </form>
   );
}
