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
   /** They read "So you're telling us…" back and said it's right. */
   confirmed: boolean;
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
   detail: '',
   confirmed: false
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
   // Inside the body → the organ hippo. Each organ mixes cheap/one-off answers with the serious ones, because
   // the organ alone doesn't decide; what's wrong and what's still to pay does.
   Brain: ['Headaches / migraine', 'Seizures / epilepsy', 'Stroke', 'Mental health'],
   Lungs: ['Asthma (inhaler)', 'Cough / bronchitis', 'TB', 'Pneumonia', 'Lung cancer'],
   Heart: ['High blood / altapresyon', 'Heart problem (needs a procedure)', 'Had a heart attack'],
   Liver: ['Hepatitis B (no treatment)', 'Fatty liver', 'Liver failure / cirrhosis', 'Liver cancer'],
   Stomach: ['Gastritis / ulcer / acid', 'Food poisoning (once)', 'Stomach cancer'],
   Kidneys: ['Kidney infection / UTI', 'Kidney stones', 'Kidney failure / dialysis'],
   Intestines: ['Diarrhea (once)', 'Appendix', 'Hernia', 'Colon cancer'],
   Bladder: ['UTI / infection', 'Prostate'],
   'Blood / all over': ['Diabetes / sugar', 'Anemia', 'Dengue / fever', 'Thyroid', 'Cancer (other)', 'Not sure yet']
};

/** Organs on /hippos/body/hippo-organs.webp, in % of the picture (checked against the image). */
export const ORGAN_SPOTS: Array<{ id: string; organ: string; x: number; y: number }> = [
   { id: 'brain', organ: 'Brain', x: 51, y: 12 },
   { id: 'lung_l', organ: 'Lungs', x: 41, y: 50 },
   { id: 'lung_r', organ: 'Lungs', x: 61, y: 50 },
   { id: 'heart', organ: 'Heart', x: 51.5, y: 54 },
   { id: 'liver', organ: 'Liver', x: 38, y: 61.5 },
   { id: 'stomach', organ: 'Stomach', x: 59, y: 60 },
   { id: 'kidney_l', organ: 'Kidneys', x: 33, y: 68.5 },
   { id: 'kidney_r', organ: 'Kidneys', x: 66, y: 67 },
   { id: 'intestines', organ: 'Intestines', x: 50, y: 71 },
   { id: 'bladder', organ: 'Bladder', x: 51, y: 78 }
];
export const ORGANS = ['Brain', 'Lungs', 'Heart', 'Liver', 'Stomach', 'Kidneys', 'Intestines', 'Bladder', 'Blood / all over'];
/** At most this many organs: more than that usually means random tapping. */
export const MAX_ORGANS = 3;

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
   (m.future === 'done' || m.future === 'unsure' || (!!m.futureAmount && !!m.payer)) &&
   m.confirmed;

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

/** "So you're telling us…": the picks read back in plain words, before they confirm. Pure. */
export const medicalSummary = (m: MedicalPick): string => {
   const who = m.who === 'me' ? 'You' : `Your ${(m.relation ?? 'family member').toLowerCase()}`;
   const what = m.conditions.length ? m.conditions.map((c) => c.split(': ').pop()).join(', ') : m.parts.join(', ');
   const since = m.since
      ? /week|month$/i.test(m.since) && !/few/i.test(m.since)
         ? `since ${m.since.toLowerCase()}`
         : `for ${m.since.toLowerCase()}`
      : '';
   const amount = (m.futureAmount ?? '').replace(/ a month$/i, '').toLowerCase();
   const more =
      m.future === 'done'
         ? 'nothing more to pay'
         : m.future === 'unsure'
           ? 'not sure about more costs'
           : m.future === 'monthly'
             ? `${amount} every month, paid by ${(m.payer ?? '').toLowerCase()}`
             : m.future === 'once'
               ? `one more cost of ${amount}, paid by ${(m.payer ?? '').toLowerCase()}`
               : '';
   return [`${who} · ${what}`, since, more].filter(Boolean).join(' · ');
};
