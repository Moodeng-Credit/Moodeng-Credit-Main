import type { LocaleCode } from '@/i18n';

// Wallet-change warnings in Account settings. They are built from the loan count and the lender's
// funding wallets at runtime, so the page translator can't match them; each locale words them here.

type WalletIntent = 'change' | 'disconnect';

interface WalletSafetyCopy {
   borrowerBlocked: (count: number, intent: WalletIntent) => string;
   lenderWarning: (count: number, walletList: string, intent: WalletIntent) => string;
   usingNonBaseWallet: (walletLabel: string) => string;
}

export const WALLET_SAFETY_COPY: Record<LocaleCode, WalletSafetyCopy> = {
   en: {
      borrowerBlocked: (count, intent) =>
         `You have ${count} active ${count === 1 ? 'loan' : 'loans'} still to repay. You can't ${intent === 'disconnect' ? 'disconnect' : 'change'} your wallet until it's fully repaid — this is the wallet your loan and repayments are tied to.`,
      lenderWarning: (count, walletList, intent) =>
         `You have ${count} active ${count === 1 ? 'loan' : 'loans'} being repaid.${
            walletList
               ? ` Repayments will still arrive at the wallet you funded from (${walletList}), not the wallet you connect here.`
               : ' Repayments will still arrive at the wallet you funded each loan from, not the wallet you connect here.'
         } ${intent === 'disconnect' ? 'Disconnecting' : 'Changing'} your wallet here is safe. It only affects loans you fund from now on.`,
      usingNonBaseWallet: (walletLabel) =>
         `Your account is using ${walletLabel}. Switch to your Instant Wallet or a Base Account so loans and repayments use the right wallet.`
   },
   fil: {
      borrowerBlocked: (count, intent) =>
         `May ${count} aktibong loan ka pang babayaran. Hindi mo puwedeng ${intent === 'disconnect' ? 'i-disconnect' : 'palitan'} ang wallet mo hangga't hindi ito bayad nang buo — ito ang wallet na nakatali sa loan at mga bayad mo.`,
      lenderWarning: (count, walletList, intent) =>
         `May ${count} aktibong loan kang binabayaran pa.${
            walletList
               ? ` Sa wallet na ginamit mo sa pagpondo (${walletList}) pa rin darating ang mga bayad, hindi sa wallet na ikokonekta mo rito.`
               : ' Sa wallet na ginamit mo sa pagpondo ng bawat loan pa rin darating ang mga bayad, hindi sa wallet na ikokonekta mo rito.'
         } Ligtas ang ${intent === 'disconnect' ? 'pag-disconnect' : 'pagpapalit'} ng wallet mo rito. Sa mga loan lang na popondohan mo mula ngayon ito may epekto.`,
      usingNonBaseWallet: (walletLabel) =>
         `Gumagamit ang account mo ng ${walletLabel}. Lumipat sa Instant Wallet mo o sa isang Base Account para tamang wallet ang gamitin sa mga loan at bayad.`
   },
   id: {
      borrowerBlocked: (count, intent) =>
         `Kamu masih punya ${count} pinjaman aktif yang harus dilunasi. Kamu tidak bisa ${intent === 'disconnect' ? 'memutus' : 'mengganti'} dompet sampai pinjaman lunas — dompet inilah yang terhubung dengan pinjaman dan pembayaranmu.`,
      lenderWarning: (count, walletList, intent) =>
         `Kamu punya ${count} pinjaman aktif yang sedang dibayar.${
            walletList
               ? ` Pembayaran tetap masuk ke dompet yang kamu pakai untuk mendanai (${walletList}), bukan dompet yang kamu hubungkan di sini.`
               : ' Pembayaran tetap masuk ke dompet yang kamu pakai untuk mendanai tiap pinjaman, bukan dompet yang kamu hubungkan di sini.'
         } ${intent === 'disconnect' ? 'Memutus' : 'Mengganti'} dompet di sini aman. Ini hanya berlaku untuk pinjaman yang kamu danai mulai sekarang.`,
      usingNonBaseWallet: (walletLabel) =>
         `Akunmu memakai ${walletLabel}. Beralih ke Instant Wallet atau Base Account agar pinjaman dan pembayaran memakai dompet yang tepat.`
   },
   th: {
      borrowerBlocked: (count, intent) =>
         `คุณยังมีเงินกู้ที่ต้องชำระคืนอยู่ ${count} รายการ คุณไม่สามารถ${intent === 'disconnect' ? 'ยกเลิกการเชื่อมต่อ' : 'เปลี่ยน'}กระเป๋าเงินได้จนกว่าจะชำระคืนครบ เพราะกระเป๋าเงินนี้ผูกกับเงินกู้และการชำระคืนของคุณ`,
      lenderWarning: (count, walletList, intent) =>
         `คุณมีเงินกู้ที่กำลังได้รับการชำระคืนอยู่ ${count} รายการ${
            walletList
               ? ` เงินชำระคืนจะยังเข้ากระเป๋าเงินที่คุณใช้ปล่อยกู้ (${walletList}) ไม่ใช่กระเป๋าเงินที่คุณเชื่อมต่อที่นี่`
               : ' เงินชำระคืนจะยังเข้ากระเป๋าเงินที่คุณใช้ปล่อยกู้แต่ละรายการ ไม่ใช่กระเป๋าเงินที่คุณเชื่อมต่อที่นี่'
         } การ${intent === 'disconnect' ? 'ยกเลิกการเชื่อมต่อ' : 'เปลี่ยน'}กระเป๋าเงินที่นี่ปลอดภัย และจะมีผลเฉพาะกับเงินกู้ที่คุณปล่อยหลังจากนี้`,
      usingNonBaseWallet: (walletLabel) =>
         `บัญชีของคุณกำลังใช้ ${walletLabel} โปรดเปลี่ยนไปใช้ Instant Wallet หรือ Base Account เพื่อให้เงินกู้และการชำระคืนใช้กระเป๋าเงินที่ถูกต้อง`
   },
   vi: {
      borrowerBlocked: (count, intent) =>
         `Bạn còn ${count} khoản vay đang cần trả. Bạn không thể ${intent === 'disconnect' ? 'ngắt kết nối' : 'đổi'} ví cho đến khi trả hết — đây là ví gắn với khoản vay và các lần trả nợ của bạn.`,
      lenderWarning: (count, walletList, intent) =>
         `Bạn có ${count} khoản vay đang được trả.${
            walletList
               ? ` Tiền trả nợ vẫn sẽ về ví bạn đã dùng để cấp vốn (${walletList}), không phải ví bạn kết nối ở đây.`
               : ' Tiền trả nợ vẫn sẽ về ví bạn đã dùng để cấp vốn cho từng khoản vay, không phải ví bạn kết nối ở đây.'
         } ${intent === 'disconnect' ? 'Ngắt kết nối' : 'Đổi'} ví ở đây là an toàn. Việc này chỉ ảnh hưởng đến các khoản vay bạn cấp vốn từ bây giờ.`,
      usingNonBaseWallet: (walletLabel) =>
         `Tài khoản của bạn đang dùng ${walletLabel}. Hãy chuyển sang Instant Wallet hoặc Base Account để khoản vay và các lần trả nợ dùng đúng ví.`
   }
};
