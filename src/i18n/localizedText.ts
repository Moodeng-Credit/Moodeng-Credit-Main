// Small bilingual (EN/FIL) text helpers shared by the Help hub and other
// localized UI. Extracted from the former Mecha `stepContext` when the AI
// assistant was removed — these are plain i18n utilities with no assistant
// dependency.

export type LocalizedText = { en: string; fil: string };
export type LocalizedList = { en: string[]; fil: string[] };

export const pickText = (t: LocalizedText, locale?: string): string => (locale === 'fil' ? t.fil : t.en);
export const pickList = (l: LocalizedList, locale?: string): string[] => (locale === 'fil' ? l.fil : l.en);
