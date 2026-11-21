// The medical question's picks → the plain answer the server grades (see MedicalBodyMap).
//
// Most real problems are inside the body (sugar, high blood, kidneys, TB…), which nobody can point at, and
// people don't like typing them out. So each body area offers the common problems there as one tap, plus
// three quick taps that matter for a loan: since when, seeing a doctor, medicine every month (George,
// 2026-11-21: "it's all about teasing their issues out of the user").

export type MedicalWho = 'no' | 'me' | 'family';
export type MedicalPick = {
   who: MedicalWho | null;
   relation: string | null;
   parts: string[];
   /** "Tummy: Kidneys / dialysis" — area + what it is. */
   conditions: string[];
   since: string | null;
   doctor: string | null;
   medicine: string | null;
   /** The part that decides a loan (George, 2026-11-21): costs still to come, not a bill already paid. */
   future: FutureCost | null;
   futureAmount: string | null;
   payer: string | null;
   detail: string;
};
export type FutureCost = 'done' | 'once' | 'monthly' | 'unsure';
export const EMPTY_MEDICAL: MedicalPick = {
   who: null,
   relation: null,
   parts: [],
   conditions: [],
   since: null,
   doctor: null,
   medicine: null,
   future: null,
   futureAmount: null,
   payer: null,
   detail: ''
};

export const MIN_DETAIL = 3;

/** What's usually wrong in each area, in everyday Filipino-English words. */
export const AREA_PROBLEMS: Record<string, string[]> = {
   Head: ['Headaches / migraine', 'Eyes', 'Ears', 'Teeth', 'Stroke', 'Seizures'],
   'Chest (heart, lungs)': ['Heart problem', 'High blood / altapresyon', 'Asthma / breathing', 'TB / pneumonia', 'Breast lump'],
   Tummy: ['Stomach / ulcer', 'Liver', 'Kidneys / dialysis', 'Pregnant / buntis', 'Appendix / gallstones'],
   Arms: ['Broken bone / injury', 'Joint pain / arthritis', 'Numbness'],
   Legs: ['Broken bone / injury', 'Joint pain / arthritis', 'Swelling', 'Wound that won’t heal'],
   Back: ['Back pain', 'Spine / slipped disc'],
   Skin: ['Rash / allergy', 'Burn', 'Infection'],
   'Feelings / stress': ['Stress / anxiety', 'Depression / sadness', 'Can’t sleep'],
   'Inside the body': [
      'Diabetes / sugar',
      'High blood / altapresyon',
      'Cancer',
      'Anemia / blood',
      'Dengue / fever',
      'Thyroid',
      'Not sure yet'
   ]
};

export const SINCE = ['This week', 'This month', 'A few months', 'A year or more'];
export const DOCTOR = ['Yes, regularly', 'Sometimes', 'Not yet', 'Can’t afford it'];
export const MEDICINE = ['Yes, every month', 'Sometimes', 'No'];

export const FUTURE: Array<[FutureCost, string]> = [
   ['done', 'No, it’s done or already paid'],
   ['once', 'Yes, one more cost coming'],
   ['monthly', 'Yes, a cost every month'],
   ['unsure', 'Not sure yet']
];
export const FUTURE_AMOUNT: Record<'once' | 'monthly', string[]> = {
   once: ['Under ₱2,000', '₱2,000–10,000', '₱10,000–50,000', 'Over ₱50,000', 'Not sure'],
   monthly: ['Under ₱1,000', '₱1,000–3,000', '₱3,000–10,000', 'Over ₱10,000 a month', 'Not sure']
};
export const PAYER = ['Me', 'Other family', 'PhilHealth / free program', 'Not sure'];

/** Enough to send: who, where, what (a tap or a few words) and since when. */
export const medicalReady = (m: MedicalPick) =>
   (m.who === 'me' || (m.who === 'family' && !!m.relation)) &&
   m.parts.length > 0 &&
   (m.conditions.length > 0 || m.detail.trim().length >= MIN_DETAIL) &&
   !!m.since &&
   !!m.future &&
   (m.future === 'done' || m.future === 'unsure' || (!!m.futureAmount && !!m.payer));

/** The answer text the server grades. '' until it's complete (so Next stays off). Pure. */
export const medicalAnswerText = (m: MedicalPick): string => {
   if (m.who === 'no') return 'no';
   if (!medicalReady(m)) return '';
   const who = m.who === 'me' ? 'Me' : `My ${m.relation!.toLowerCase()}`;
   const what = m.conditions.length ? m.conditions.join(', ') : m.parts.join(', ');
   const bits = [
      who,
      what,
      `since: ${m.since!.toLowerCase()}`,
      m.doctor ? `doctor: ${m.doctor.toLowerCase()}` : null,
      m.medicine ? `medicine: ${m.medicine.toLowerCase()}` : null,
      m.future === 'done'
         ? 'more costs: no, done or already paid'
         : m.future === 'unsure'
           ? 'more costs: not sure yet'
           : m.future
             ? `more costs: ${m.future === 'monthly' ? 'every month' : 'one more'}, about ${m.futureAmount!.toLowerCase()}, paid by ${m.payer!.toLowerCase()}`
             : null,
      m.detail.trim() || null
   ].filter(Boolean);
   return bits.join(' — ').slice(0, 600);
};
