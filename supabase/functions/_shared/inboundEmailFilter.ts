// Which mail to support@ is a machine, not a person asking for help (email-inbound).
//
// support@ also receives service mail: calendar invites, sign-in codes, "welcome" mail, e-signature
// notices, Gmail/Microsoft account notices. None of it is a support request, so none of it may open a
// Discord ticket. It isn't lost: support@ is also copied to George's Gmail. Vendors and partners who
// write by hand (Xoxoday, Giftaway, Stableyard…) still come through.
//
// Tuned on the 44 emails that reached support@ between Sep 29 and Oct 23, 2026.

// The local part says "machine": no-reply anywhere in it (gmail-noreply@, account-security-noreply@),
// or a role address that only ever sends.
const AUTOMATED_LOCAL =
   /(^|[._+-])(no-?reply|do-?not-?reply|donotreply)([._+-]|$)|^(notifications?|notify|mailer-daemon|postmaster|bounces?|alerts?|news(letter)?|billing|receipts?|updates?|marketing|auth|verify|security|informations?)([._+-]|$)/i;

// Senders that only ever send automated mail (calendar and e-signature services, account notices).
const AUTOMATED_DOMAIN =
   /(^|\.)(cal\.com|calendly\.com|signnow\.com|docusign\.(net|com)|accountprotection\.microsoft\.com|notify\.[a-z0-9.-]+|updates\.[a-z0-9.-]+|mail\.anthropic\.com)$/i;

// Our own outgoing mail coming back around (reminders, "we missed you on the call").
const OWN_DOMAIN = /@moodeng\.(app|credit)$/i;

// Subjects that are always a machine: calendar traffic, codes and verification, welcomes, signatures.
const AUTOMATED_SUBJECT = new RegExp(
   [
      '^(invitation|updated invitation|invitation updated|accepted|declined|tentatively accepted|canceled|cancelled|new event):',
      'booked a meeting with',
      'has been rescheduled',
      '^a reminder for (our|your) upcoming meeting',
      '\\bverify your (work )?email',
      '\\bconfirm your email',
      '\\bverification code\\b',
      '^code \\d{4,8}\\b',
      '\\b\\d{4,8} - your .*code\\b',
      '^welcome to\\b',
      'signature request from',
      'has been completed$',
      '^gmail confirmation',
      'security info was added'
   ].join('|'),
   'i'
);

export const isAutomatedEmail = (
   fromEmail: string,
   subject: string,
   readHeader: (name: string) => string | null
): boolean => {
   const email = fromEmail.trim().toLowerCase();
   const [local = '', domain = ''] = email.split('@');
   if (AUTOMATED_LOCAL.test(local) || AUTOMATED_DOMAIN.test(domain) || OWN_DOMAIN.test(email)) return true;
   if (AUTOMATED_SUBJECT.test(subject.trim())) return true;
   const autoSubmitted = readHeader('auto-submitted');
   if (autoSubmitted && autoSubmitted.toLowerCase() !== 'no') return true;
   if (readHeader('list-unsubscribe') || readHeader('list-id')) return true;
   const precedence = readHeader('precedence')?.toLowerCase();
   if (precedence === 'bulk' || precedence === 'list' || precedence === 'junk' || precedence === 'auto_reply') return true;
   // Calendar invites carry a text/calendar part.
   return /text\/calendar/i.test(readHeader('content-type') ?? '');
};
