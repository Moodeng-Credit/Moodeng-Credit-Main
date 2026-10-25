// George's phone shows a borrower's WhatsApp as "+63 917 … ~Luis", "Not a contact". A Telegram
// contact card in the KYC chat fixes that in one tap: "Add to contacts" saves the number under their
// name, and WhatsApp picks the name up from the phone's contacts.

export type ContactCardPerson = {
   kycFirstName?: string | null;
   kycLastName?: string | null;
   displayName?: string | null;
   username?: string | null;
};

// sendContact payload (minus chat_id). Their ID's name when KYC has it, else the name they gave us;
// " (Moodeng)" marks them as a borrower in the phone's contacts. Null without a usable number.
export const whatsappContactCard = (phoneDigits: string | null | undefined, person: ContactCardPerson) => {
   const digits = String(phoneDigits ?? '').replace(/\D/g, '');
   if (digits.length < 8 || digits.length > 15) return null;
   const kycFirst = person.kycFirstName?.trim();
   const kycLast = person.kycLastName?.trim();
   const fallback = person.displayName?.trim() || (person.username ? `@${person.username}` : '') || 'Borrower';
   const first = kycFirst || kycLast || fallback;
   const last = kycFirst && kycLast ? `${kycLast} (Moodeng)` : '(Moodeng)';
   return { phone_number: `+${digits}`, first_name: first.slice(0, 64), last_name: last.slice(0, 64) };
};
