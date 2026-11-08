import type { ProofPagePreview } from '@/app/proof/page';

// Sample data for /proof-preview (design check only, never writes).
export const PROOF_PAGE_SAMPLE: ProofPagePreview = {
   stage: 'open',
   request: {
      first_name: 'Ana',
      message: 'You said you work as a nurse in Dubai. Please send your work visa and a payslip so we can approve you.',
      stage: 'open',
      ask_again: null,
      file_counts: {},
      answers: { q_abroad: { text: 'Dubai, UAE. My contract ends March 2028.' } },
      items: [
         {
            id: 'visa',
            kind: 'proof',
            label: 'Your work visa or permit abroad',
            hint: 'Photo of your visa page, work permit, OEC, or job contract'
         },
         {
            id: 'work',
            kind: 'proof',
            label: 'Proof you work at your company',
            hint: 'Company ID, latest payslip, or certificate of employment'
         },
         { id: 'q_abroad', kind: 'question', label: 'Which country do you work in, and when does your contract end?' },
         { id: 'q_company', kind: 'question', label: 'What is the name of your company?' }
      ]
   },
   picked: [{ item: 'visa', name: 'visa-page.pdf' }]
};
