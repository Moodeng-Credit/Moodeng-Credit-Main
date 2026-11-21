// The medical question's picks → the plain answer the server grades (see MedicalBodyMap).

export type MedicalWho = 'no' | 'me' | 'family';
export type MedicalPick = { who: MedicalWho | null; relation: string | null; parts: string[]; detail: string };
export const EMPTY_MEDICAL: MedicalPick = { who: null, relation: null, parts: [], detail: '' };

export const MIN_DETAIL = 3;

/** The answer text the server grades. '' until it's complete (so Next stays off). Pure. */
export const medicalAnswerText = (m: MedicalPick): string => {
   if (m.who === 'no') return 'no';
   if (!m.who || (m.who === 'family' && !m.relation) || !m.parts.length || m.detail.trim().length < MIN_DETAIL) return '';
   const who = m.who === 'me' ? 'Me' : `My ${m.relation!.toLowerCase()}`;
   return `${who} — ${m.parts.join(', ')} — ${m.detail.trim()}`.slice(0, 600);
};
