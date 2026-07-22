// Localized chrome copy for Mecha's UI. Follows the dominant per-feature pattern
// (see src/views/support/Support.tsx): a Record keyed by locale, read via
// useLocalization().locale with an English fallback. The chat *answers* come from
// the model (which matches the user's language); this only covers the shell.

export type MechaCopy = {
   name: string;
   tagline: string;
   inputPlaceholder: string;
   send: string;
   greeting: string;
   suggestionsLabel: string;
   humanTitle: string;
   humanBody: string;
   humanCta: string;
   humanSending: string;
   humanSent: string;
   contactPlaceholder: string;
   errorLine: string;
   openLabel: string;
   closeLabel: string;
   restart: string;
   helpTitle: string;
   helpSubtitle: string;
   popularLabel: string;
   footerNote: string;
   browseAll: string;
   typingLabel: string;
   feedbackUp: string;
   feedbackDown: string;
   feedbackThanks: string;
   tryAgain: string;
};

const en: MechaCopy = {
   name: 'Mecha',
   tagline: 'Moodeng Support Officer',
   inputPlaceholder: 'Ask me anything about Moodeng…',
   send: 'Send',
   greeting: "Hi, I'm Mecha 🤖 — ask me anything about Moodeng: verifying, wallets, borrowing, or cashing out.",
   suggestionsLabel: 'Try asking',
   humanTitle: 'Talk to the team',
   humanBody: 'Want a real person? I can pass this chat to the Moodeng team.',
   humanCta: 'Connect me with the team',
   humanSending: 'Sending…',
   humanSent: "Sent! The team has your question and will follow up. You can keep chatting with me too.",
   contactPlaceholder: 'How can the team reach you? (optional)',
   errorLine: 'Something went wrong on my end. Please try again, or I can connect you with the team.',
   openLabel: 'Chat with Mecha',
   closeLabel: 'Close chat',
   restart: 'Start over',
   helpTitle: 'How can we help?',
   helpSubtitle: 'Ask Mecha anything, or browse the popular guides below.',
   popularLabel: 'Popular right now',
   footerNote: 'Mecha answers from Moodeng’s help docs.',
   browseAll: 'Browse all FAQs & guides →',
   typingLabel: 'Mecha is typing',
   feedbackUp: 'Helpful',
   feedbackDown: 'Not helpful',
   feedbackThanks: 'Thanks for the feedback!',
   tryAgain: 'Try again'
};

const fil: MechaCopy = {
   ...en,
   tagline: 'Support Officer ng Moodeng',
   inputPlaceholder: 'Magtanong tungkol sa Moodeng…',
   send: 'Ipadala',
   greeting: "Hi, ako si Mecha 🤖 — magtanong ka lang tungkol sa Moodeng: verify, wallet, panghihiram, o pag-cash out.",
   suggestionsLabel: 'Subukan mong itanong',
   humanTitle: 'Kausapin ang team',
   humanBody: 'Gusto mo ng tunay na tao? Maipapasa ko ang chat na ito sa Moodeng team.',
   humanCta: 'Ikonekta ako sa team',
   humanSending: 'Ipinapadala…',
   humanSent: 'Naipadala na! Nasa team na ang tanong mo at magfa-follow up sila. Puwede ka pa ring magtanong sa akin.',
   contactPlaceholder: 'Paano ka makokontak ng team? (opsyonal)',
   errorLine: 'May nangyaring mali sa akin. Pakisubukan ulit, o ikokonekta kita sa team.',
   openLabel: 'Mag-chat kay Mecha',
   closeLabel: 'Isara ang chat',
   restart: 'Magsimula ulit',
   helpTitle: 'Paano ka namin matutulungan?',
   helpSubtitle: 'Magtanong kay Mecha, o tingnan ang mga popular na gabay sa ibaba.',
   popularLabel: 'Sikat ngayon',
   footerNote: 'Sumasagot si Mecha mula sa help docs ng Moodeng.',
   browseAll: 'Tingnan lahat ng FAQs at gabay →',
   typingLabel: 'Nagta-type si Mecha',
   feedbackUp: 'Nakatulong',
   feedbackDown: 'Hindi nakatulong',
   feedbackThanks: 'Salamat sa feedback!',
   tryAgain: 'Subukan ulit'
};

const MECHA_COPY: Record<string, MechaCopy> = { en, fil };

export function getMechaCopy(locale: string | undefined): MechaCopy {
   return (locale && MECHA_COPY[locale]) || MECHA_COPY.en;
}

// Languages offered by the in-chat flag switcher. English + Tagalog for now —
// the two Mecha has full chrome copy for, and the pair most PH users need.
// (Model answers still match whatever language the user actually types.)
export type MechaLang = { code: string; flag: string; short: string; label: string };
export const MECHA_LANGS: MechaLang[] = [
   { code: 'en', flag: '🇬🇧', short: 'EN', label: 'English' },
   { code: 'fil', flag: '🇵🇭', short: 'TL', label: 'Tagalog' }
];
