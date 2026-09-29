import { type LocaleCode, resolveLocaleCode } from '@/i18n/translations';

// Whole sentences that wrap a number or a name. Split into fragments they can't be translated in the
// right word order, so each locale words the full sentence here. Components render them through
// SentenceLabels.tsx; plain helpers read the current language from <html lang>.

interface Sentences {
   uniqueLenders: (count: number) => string;
   moreCharactersToGo: (count: number) => string;
   moreCharacters: (count: number) => string;
   fundLoanTitle: (name: string) => string;
   fundedLoanBody: (name: string) => string;
   transferAddress: (exchange: string) => string;
   quizRestartConfirm: string;
}

export const SENTENCES: Record<LocaleCode, Sentences> = {
   en: {
      uniqueLenders: (count) => `${count} Unique ${count === 1 ? 'Lender' : 'Lenders'}`,
      moreCharactersToGo: (count) => `${count} more character${count === 1 ? '' : 's'} to go`,
      moreCharacters: (count) => `${count} more characters`,
      fundLoanTitle: (name) => `Fund ${name}’s loan`,
      fundedLoanBody: (name) => `You funded ${name}’s loan. If they repay, the repayment is automatically sent to your wallet.`,
      transferAddress: (exchange) => `Your ${exchange} transfer address`,
      quizRestartConfirm: 'Switching reward type will restart the quiz from question 1. Continue?'
   },
   fil: {
      uniqueLenders: (count) => `${count} magkakaibang lender`,
      moreCharactersToGo: (count) => `${count} character pa ang kailangan`,
      moreCharacters: (count) => `${count} character pa`,
      fundLoanTitle: (name) => `Pondohan ang loan ni ${name}`,
      fundedLoanBody: (name) => `Pinondohan mo ang loan ni ${name}. Kapag nagbayad sila, awtomatikong ipapadala ang bayad sa wallet mo.`,
      transferAddress: (exchange) => `Ang ${exchange} transfer address mo`,
      quizRestartConfirm: 'Kapag pinalitan mo ang uri ng reward, magsisimula ulit ang quiz sa unang tanong. Ituloy?'
   },
   id: {
      uniqueLenders: (count) => `${count} pemberi pinjaman berbeda`,
      moreCharactersToGo: (count) => `${count} karakter lagi`,
      moreCharacters: (count) => `${count} karakter lagi`,
      fundLoanTitle: (name) => `Danai pinjaman ${name}`,
      fundedLoanBody: (name) => `Kamu telah mendanai pinjaman ${name}. Jika mereka membayar, pembayarannya otomatis dikirim ke dompetmu.`,
      transferAddress: (exchange) => `Alamat transfer ${exchange} kamu`,
      quizRestartConfirm: 'Mengganti jenis hadiah akan memulai ulang kuis dari pertanyaan pertama. Lanjutkan?'
   },
   th: {
      uniqueLenders: (count) => `ผู้ให้กู้ที่ไม่ซ้ำกัน ${count} ราย`,
      moreCharactersToGo: (count) => `อีก ${count} ตัวอักษร`,
      moreCharacters: (count) => `อีก ${count} ตัวอักษร`,
      fundLoanTitle: (name) => `ปล่อยกู้ให้ ${name}`,
      fundedLoanBody: (name) => `คุณได้ปล่อยกู้ให้ ${name} แล้ว เมื่อผู้ยืมชำระคืน เงินจะถูกส่งเข้ากระเป๋าเงินของคุณโดยอัตโนมัติ`,
      transferAddress: (exchange) => `ที่อยู่สำหรับโอนของ ${exchange}`,
      quizRestartConfirm: 'การเปลี่ยนประเภทรางวัลจะเริ่มแบบทดสอบใหม่ตั้งแต่ข้อแรก ต้องการดำเนินการต่อไหม?'
   },
   vi: {
      uniqueLenders: (count) => `${count} người cho vay khác nhau`,
      moreCharactersToGo: (count) => `Còn ${count} ký tự nữa`,
      moreCharacters: (count) => `Còn ${count} ký tự nữa`,
      fundLoanTitle: (name) => `Cấp vốn cho khoản vay của ${name}`,
      fundedLoanBody: (name) => `Bạn đã cấp vốn cho khoản vay của ${name}. Khi họ trả nợ, tiền sẽ tự động được gửi vào ví của bạn.`,
      transferAddress: (exchange) => `Địa chỉ chuyển tiền ${exchange} của bạn`,
      quizRestartConfirm: 'Đổi loại phần thưởng sẽ bắt đầu lại bài kiểm tra từ câu 1. Tiếp tục?'
   }
};

/** Sentences for the language the app is showing, for event handlers and helpers outside React. */
export function currentSentences(): Sentences {
   const locale = typeof document === 'undefined' ? null : resolveLocaleCode(document.documentElement.lang);
   return SENTENCES[locale ?? 'en'];
}
