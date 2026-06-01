import { describe, expect, it } from 'vitest';

import { filipinoScreenTranslations, screenTranslationsByLocale } from '@/i18n/screenTranslations';
import { pickInitialLocale, resolveLocaleCode, translate, translations } from '@/i18n/translations';
import { getAccountFaqsForLocale } from '@/views/account/data/accountFaqs';
import { getFaqsForLocale } from '@/views/support/data/faqs';
import { getGuideForLocale, getGuidesForLocale } from '@/views/support/data/guides';

describe('localization translations', () => {
   it('maps English, Filipino, Tagalog, Indonesian, Thai, and Vietnamese locale inputs to supported locales', () => {
      expect(resolveLocaleCode('en-US')).toBe('en');
      expect(resolveLocaleCode('fil-PH')).toBe('fil');
      expect(resolveLocaleCode('tl-PH')).toBe('fil');
      expect(resolveLocaleCode('id-ID')).toBe('id');
      expect(resolveLocaleCode('indonesian')).toBe('id');
      expect(resolveLocaleCode('bahasa-indonesia')).toBe('id');
      expect(resolveLocaleCode('th-TH')).toBe('th');
      expect(resolveLocaleCode('thai')).toBe('th');
      expect(resolveLocaleCode('vi-VN')).toBe('vi');
      expect(resolveLocaleCode('vietnamese')).toBe('vi');
      expect(resolveLocaleCode('fr-FR')).toBeNull();
   });

   it('prefers the stored language before browser language', () => {
      expect(
         pickInitialLocale({
            storedLocale: 'fil',
            browserLocales: ['en-US']
         })
      ).toBe('fil');
   });

   it('falls back to browser language and then English', () => {
      expect(
         pickInitialLocale({
            storedLocale: null,
            browserLocales: ['tl-PH']
         })
      ).toBe('fil');
      expect(
         pickInitialLocale({
            storedLocale: null,
            browserLocales: ['fr-FR']
         })
      ).toBe('en');
   });

   it('keeps Filipino translations aligned with English keys', () => {
      expect(Object.keys(translations.fil).sort()).toEqual(Object.keys(translations.en).sort());
   });

   it('keeps Indonesian translations aligned with English keys', () => {
      expect(Object.keys(translations.id).sort()).toEqual(Object.keys(translations.en).sort());
   });

   it('keeps Thai translations aligned with English keys', () => {
      expect(Object.keys(translations.th).sort()).toEqual(Object.keys(translations.en).sort());
   });

   it('keeps Vietnamese translations aligned with English keys', () => {
      expect(Object.keys(translations.vi).sort()).toEqual(Object.keys(translations.en).sort());
   });

   it('interpolates translated parameters', () => {
      expect(translate('fil', 'points.total', { points: '12.5' })).toBe('IOU 12.5');
      expect(translate('id', 'auth.signIn')).toBe('Masuk');
      expect(translate('th', 'auth.signIn')).toBe('เข้าสู่ระบบ');
      expect(translate('vi', 'auth.signIn')).toBe('Đăng nhập');
   });

   it('keeps canonical screen titles in the correct language records', () => {
      expect(translations.en['requestBoard.title']).toBe('Microloan Request Board');
      expect(translations.fil['requestBoard.title']).toBe('Board ng Microloan Requests');
   });

   it('covers visible mobile app shell and support phrases in Filipino', () => {
      expect(translations.fil['bottomNav.history']).toBe('Kasaysayan');
      expect(translations.fil['bottomNav.account']).toBe('Ako');
      expect(filipinoScreenTranslations['Transaction History']).toBe('Kasaysayan ng mga transaksyon');
      expect(filipinoScreenTranslations['Learn the Moodeng Basics']).toBe('Alamin ang basics ng Moodeng');
      expect(filipinoScreenTranslations['Lent by']).toBe('Pinahiram ng');
      expect(screenTranslationsByLocale.id['Transaction History']).toBe('Riwayat transaksi');
      expect(screenTranslationsByLocale.id['Need short-term support?']).toBe('Butuh dukungan jangka pendek?');
      expect(screenTranslationsByLocale.th['Transaction History']).toBe('ประวัติธุรกรรม');
      expect(screenTranslationsByLocale.vi['Need short-term support?']).toBe('Cần hỗ trợ ngắn hạn?');
   });

   it('localizes support guide cards and detail body copy', () => {
      expect(getGuidesForLocale('fil').map((guide) => guide.title)).toContain('Paano gumagana ang mga antas ng kredito');
      expect(getGuideForLocale('how-credit-levels-work', 'fil')?.body).toContain('Tinutukoy ng mga antas ng kredito');
      expect(getGuideForLocale('verification-and-why-its-required', 'fil')?.body).toContain('Bakit kailangan mag-verify?');
      expect(getGuidesForLocale('id').map((guide) => guide.title)).toContain('Cara kerja level kredit');
      expect(getGuideForLocale('how-credit-levels-work', 'id')?.body).toContain('Level kredit menentukan');
      expect(getGuideForLocale('verification-and-why-its-required', 'id')?.body).toContain('Mengapa perlu verifikasi?');
      expect(getGuidesForLocale('th').map((guide) => guide.title)).toContain('ระดับเครดิตทำงานอย่างไร');
      expect(getGuideForLocale('how-credit-levels-work', 'th')?.body).toContain('ระดับเครดิตกำหนด');
      expect(getGuidesForLocale('vi').map((guide) => guide.title)).toContain('Hạng tín dụng hoạt động như thế nào');
      expect(getGuideForLocale('how-credit-levels-work', 'vi')?.body).toContain('Hạng tín dụng xác định');
   });

   it('localizes account and support FAQ records', () => {
      expect(getAccountFaqsForLocale('fil', false).map((faq) => faq.question)).toContain('Paano ko babayaran ang loan ko?');
      expect(getAccountFaqsForLocale('fil', false).find((faq) => faq.id === 'borrow-below-limit')?.answer).toContain('Trust-Building Loan');
      expect(getFaqsForLocale('fil').map((faq) => faq.question)).toContain('Ano ang Moodeng Credit?');
      expect(getFaqsForLocale('fil').find((faq) => faq.id === 'does-moodeng-charge-fees')?.answer).toContain('Libre gamitin');
      expect(getAccountFaqsForLocale('id', false).map((faq) => faq.question)).toContain('Bagaimana cara membayar pinjaman saya?');
      expect(getAccountFaqsForLocale('id', false).find((faq) => faq.id === 'borrow-below-limit')?.answer).toContain('Trust-Building Loan');
      expect(getFaqsForLocale('id').map((faq) => faq.question)).toContain('Apa itu Moodeng Credit?');
      expect(getFaqsForLocale('id').find((faq) => faq.id === 'does-moodeng-charge-fees')?.answer).toContain('gratis digunakan');
      expect(getAccountFaqsForLocale('th', false).map((faq) => faq.question)).toContain('ฉันจะชำระคืนเงินกู้ได้อย่างไร?');
      expect(getFaqsForLocale('th').map((faq) => faq.question)).toContain('Moodeng Credit คืออะไร?');
      expect(getAccountFaqsForLocale('vi', false).map((faq) => faq.question)).toContain('Tôi trả khoản vay bằng cách nào?');
      expect(getFaqsForLocale('vi').map((faq) => faq.question)).toContain('Moodeng Credit là gì?');
   });
});
