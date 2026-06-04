import { type LocaleCode, useLocalization } from '@/i18n';

interface NotificationOption {
   id: string;
   label: string;
   description: string;
}

const NOTIFICATION_SETTINGS_COPY: Record<LocaleCode, { title: string; body: string; options: NotificationOption[] }> = {
   en: {
      title: 'Notification',
      body: 'Get notified of activity going on with your account. Notifications will be sent to the email that you have provided.',
      options: [
         {
            id: 'account-activity',
            label: 'Account Activity',
            description: "Get important notifications about you or activity you've missed"
         },
         {
            id: 'transaction-activity',
            label: 'Transaction Activity',
            description: 'Get important notifications about your transactions'
         },
         {
            id: 'moodeng-blogs',
            label: 'Moodeng Blogs',
            description: 'Get updated with our latest news, updates and blogs'
         }
      ]
   },
   fil: {
      title: 'Mga notification',
      body: 'Makakatanggap ka ng abiso tungkol sa activity sa account mo. Ipapadala ang notifications sa email na ibinigay mo.',
      options: [
         {
            id: 'account-activity',
            label: 'Activity ng account',
            description: 'Makakatanggap ka ng mahahalagang notification tungkol sa iyo o sa activity na na-miss mo.'
         },
         {
            id: 'transaction-activity',
            label: 'Aktibidad ng transaksyon',
            description: 'Makakatanggap ka ng mahahalagang notification tungkol sa transactions mo.'
         },
         {
            id: 'moodeng-blogs',
            label: 'Mga blog ng Moodeng',
            description: 'Makatanggap ng updates tungkol sa pinakabagong balita, updates, at blogs namin.'
         }
      ]
   },
   id: {
      title: 'Notifikasi',
      body: 'Dapatkan notifikasi tentang aktivitas di akun kamu. Notifikasi akan dikirim ke email yang kamu berikan.',
      options: [
         {
            id: 'account-activity',
            label: 'Aktivitas akun',
            description: 'Dapatkan notifikasi penting tentang kamu atau aktivitas yang terlewat.'
         },
         {
            id: 'transaction-activity',
            label: 'Aktivitas transaksi',
            description: 'Dapatkan notifikasi penting tentang transaksimu.'
         },
         {
            id: 'moodeng-blogs',
            label: 'Blog Moodeng',
            description: 'Dapatkan update tentang berita, pembaruan, dan blog terbaru kami.'
         }
      ]
   }
};

export default function NotificationSettings() {
   const { locale } = useLocalization();
   const copy = NOTIFICATION_SETTINGS_COPY[locale] ?? NOTIFICATION_SETTINGS_COPY.en;

   return (
      <form className="flex flex-col md:flex-row gap-8">
         <div className="flex flex-col gap-16 w-full md:w-1/3 text-[10px] text-[#4a4a4a] font-normal leading-[12px]">
            <section>
               <h2 className="font-semibold text-[12px] text-[#0a1a5f] mb-2 select-none">{copy.title}</h2>
               <p>{copy.body}</p>
            </section>
         </div>
         <div className="flex flex-col w-full md:w-2/3 space-y-6 text-[10px] text-[#4a4a4a] font-normal leading-[12px]">
            <div className="flex flex-col gap-1">
               {copy.options.map((option) => (
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
