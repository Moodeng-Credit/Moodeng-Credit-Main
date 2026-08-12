import { useSelector } from 'react-redux';

import { usePushNotifications } from '@/hooks/usePushNotifications';
import { type LocaleCode, useLocalization } from '@/i18n';
import { type RootState } from '@/store/store';

interface NotificationOption {
   id: string;
   label: string;
   description: string;
}

type PushCopy = {
   label: string;
   description: string;
   enable: string;
   disable: string;
   working: string;
   /** Shown when the browser has blocked notifications — only the user can undo that. */
   blocked: string;
   unsupported: string;
};

const PUSH_COPY: Record<LocaleCode, PushCopy> = {
   en: {
      label: 'Push notifications on this device',
      description:
         'Get a notification the moment a repayment is due, or when a borrower who already repaid you asks again. Applies to this device only.',
      enable: 'Turn on',
      disable: 'Turn off',
      working: 'Working…',
      blocked: 'Notifications are blocked in your browser settings. Allow them there, then come back.',
      unsupported: 'This browser cannot show push notifications. Try Chrome, or add Moodeng to your home screen.'
   },
   fil: {
      label: 'Push notifications sa device na ito',
      description:
         'Makakatanggap ka ng abiso kapag malapit nang mag-due ang bayad mo, o kapag humiram ulit ang borrower na nakabayad na sa iyo. Sa device na ito lang.',
      enable: 'I-on',
      disable: 'I-off',
      working: 'Sandali lang…',
      blocked: 'Naka-block ang notifications sa browser settings mo. I-allow mo muna doon, tapos balik ka rito.',
      unsupported: 'Hindi kayang mag-push notification ng browser na ito. Subukan ang Chrome, o i-add ang Moodeng sa home screen.'
   },
   id: {
      label: 'Notifikasi push di perangkat ini',
      description:
         'Dapatkan notifikasi saat pembayaran jatuh tempo, atau saat peminjam yang sudah melunasi ke kamu mengajukan lagi. Hanya untuk perangkat ini.',
      enable: 'Aktifkan',
      disable: 'Matikan',
      working: 'Memproses…',
      blocked: 'Notifikasi diblokir di pengaturan browser. Izinkan dulu di sana, lalu kembali ke sini.',
      unsupported: 'Browser ini tidak mendukung notifikasi push. Coba Chrome, atau tambahkan Moodeng ke layar utama.'
   }
};

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
   const pushCopy = PUSH_COPY[locale] ?? PUSH_COPY.en;
   const userId = useSelector((state: RootState) => state.auth.user?.id);
   const push = usePushNotifications(userId ?? null);

   // A blocked permission can only be lifted from browser settings, so the
   // control is replaced with an explanation rather than a button that would
   // silently do nothing.
   const isBlocked = push.permission === 'denied';

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

            {/* Push is per-device, not per-account: the toggle reflects whether
                *this* browser holds a live subscription, which is why it sits
                apart from the account-wide category checkboxes above. */}
            <div className="flex flex-col gap-1 border-t border-gray-200 pt-4">
               <div className="flex items-start justify-between gap-3">
                  <div>
                     <p className="text-[10px] font-semibold text-[#0a1a5f] leading-[12px] select-none">{pushCopy.label}</p>
                     <p className="text-[8px] text-[#4a4a4a] font-normal leading-[10px]">{pushCopy.description}</p>
                  </div>

                  {push.isSupported && !isBlocked && (
                     <button
                        type="button"
                        disabled={push.isBusy}
                        onClick={() => void (push.isSubscribed ? push.disable() : push.enable())}
                        className="shrink-0 rounded-full px-3 py-1 text-[9px] font-semibold text-white bg-[#6010d2] disabled:opacity-60"
                     >
                        {push.isBusy ? pushCopy.working : push.isSubscribed ? pushCopy.disable : pushCopy.enable}
                     </button>
                  )}
               </div>

               {isBlocked && <p className="text-[8px] text-[#b4291f] font-normal leading-[10px]">{pushCopy.blocked}</p>}
               {!push.isSupported && (
                  <p className="text-[8px] text-[#4a4a4a] font-normal leading-[10px]">{pushCopy.unsupported}</p>
               )}
            </div>
         </div>
      </form>
   );
}
