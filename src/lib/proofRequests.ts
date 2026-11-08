// Proof requests: after a call, the team asks a new applicant to back up what they said (proof they
// work at their company, their work visa abroad, a couple of written answers) with one link,
// moodeng.app/proof/<token>. See the proof_requests migration. Shared by the page and the admin.

export type ProofItemKind = 'proof' | 'question';
export type ProofItem = { id: string; kind: ProofItemKind; label: string; hint?: string | null };
export type ProofAnswer = { text?: string; missing?: boolean };
export type ProofAnswers = Record<string, ProofAnswer>;

/** Ready-made things to ask for, by what people usually say on the call. */
export const PROOF_PRESETS: Array<ProofItem & { emoji: string }> = [
   {
      id: 'work',
      kind: 'proof',
      emoji: '🏢',
      label: 'Proof you work at your company',
      hint: 'Company ID, latest payslip, or certificate of employment'
   },
   {
      id: 'visa',
      kind: 'proof',
      emoji: '✈️',
      label: 'Your work visa or permit abroad',
      hint: 'Photo of your visa page, work permit, OEC, or job contract'
   },
   {
      id: 'business',
      kind: 'proof',
      emoji: '🏪',
      label: 'Proof of your business',
      hint: 'Business permit or DTI, a photo of your store, or recent sales records'
   },
   {
      id: 'remittance',
      kind: 'proof',
      emoji: '💸',
      label: 'Money you get from abroad',
      hint: 'Remittance receipts or GCash history from the last 2–3 months'
   },
   { id: 'wallet', kind: 'proof', emoji: '📱', label: 'GCash or Maya history', hint: 'Screenshots of the last 2–3 months' },
   { id: 'school', kind: 'proof', emoji: '🎓', label: 'School ID or enrollment', hint: 'Your school ID or this term’s registration form' },
   { id: 'address', kind: 'proof', emoji: '🏠', label: 'Proof of address', hint: 'A recent electric, water or internet bill' }
];

export const QUESTION_PRESETS: ProofItem[] = [
   { id: 'q_company', kind: 'question', label: 'What is the name of your company?' },
   { id: 'q_job', kind: 'question', label: 'What is your job, and how long have you worked there?' },
   { id: 'q_abroad', kind: 'question', label: 'Which country do you work in, and when does your contract end?' },
   { id: 'q_payday', kind: 'question', label: 'When do you get paid each month?' },
   { id: 'q_contact', kind: 'question', label: 'Who can we contact to confirm? (name and number)' }
];

export const MAX_ITEMS = 10;

/** A short random id for a custom item. */
export const customItemId = (kind: ProofItemKind) => `${kind === 'proof' ? 'p' : 'q'}_${Math.random().toString(36).slice(2, 8)}`;

/** What's still missing before they can press Send — one line per item, empty = ready. Pure. */
export const missingItems = (items: ProofItem[], answers: ProofAnswers, fileCounts: Record<string, number>) =>
   items.filter((item) => {
      const a = answers[item.id] ?? {};
      if (item.kind === 'question') return !a.text?.trim();
      if (a.missing) return !a.text?.trim();
      return !(fileCounts[item.id] > 0);
   });

export const proofLink = (token: string) => `https://moodeng.app/proof/${token}`;

/** The message the team pastes into Messenger when they send the link by hand. Pure. */
export const proofLinkMessage = (firstName: string | null, token: string) =>
   `Hi${firstName ? ` ${firstName}` : ''}! Thanks for the call 😊 To finish your application, please send the proof we talked about here (about 2 minutes, no sign-in needed):\n${proofLink(token)}`;
