// Pull Moodeng Messenger codes out of whatever text reached us: a bare ref from the m.me link
// ("MDNG-3D66AD"), or something a borrower typed to the Page ("mdng 3d66ad", "my code is MDNG–3D66AD.").
//
// Codes come from start_contact_verification: 'MDNG-' + 6 uppercase hex characters. Only that exact
// shape ever reaches the database query, so nothing a borrower types can act as a wildcard (the old
// ilike match let "MDNG-%" confirm whichever code happened to be pending).
//
// Typing slips are forgiven where they can't be ambiguous: any separator (or none) after MDNG, any
// case, and the letters O / I / L for the digits 0 / 1 — hex never contains O, I or L.

const CODE_IN_TEXT = /MDNG[\s\-_–—.:]*([A-Z0-9]{6})(?![A-Z0-9])/gi;
const HEX6 = /^[0-9A-F]{6}$/;

export const extractMessengerCodes = (raw: string | null | undefined): string[] => {
   const out = new Set<string>();
   for (const match of (raw ?? '').matchAll(CODE_IN_TEXT)) {
      const body = match[1].toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
      if (HEX6.test(body)) out.add(`MDNG-${body}`);
   }
   return [...out];
};
