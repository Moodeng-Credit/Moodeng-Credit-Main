import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { isAutomatedEmail } from './inboundEmailFilter.ts';

const noHeaders = () => null;

// Real mail that reached support@ (Sep 29 – Oct 23, 2026).
const machine: Array<[string, string]> = [
   ['gmail-noreply@google.com', 'Gmail Confirmation - Send Mail as support@moodeng.app'],
   ['microsoft-noreply@microsoft.com', 'Still deciding? Your $1.00 Xbox Digital Gift Card is waiting'],
   ['account-security-noreply@accountprotection.microsoft.com', 'Verify your email address'],
   ['hello@cal.com', 'Video interview between Emma Moodeng Credit and support+guesttest1'],
   ['hello@cal.com', 'Canceled: Video interview between Emma Moodeng Credit and support+guesttest1 at 12:00pm'],
   ['emery.villas@zoom.us', 'Updated invitation: Zoom Meeting for Moodeng Credit @ Thu Oct 22, 2026 1:30pm - 2pm (EDT)'],
   ['emery.villas@zoom.com', 'Invitation: Emery’s Calendar - George Lerner and Emery Villas @ Thu Oct 22, 2026'],
   ['max@due.network', 'Invitation: MoodengCredit x Due @ Wed 21 Oct 2026 2:15pm - 2:45pm (BST)'],
   ['avipsa@xoxoday.com', 'jimmy lerner booked a meeting with: Avipsa Biswal'],
   ['avipsa@xoxoday.com', 'A reminder for our upcoming meeting'],
   ['hello@producthunt.com', 'Verify your work email address'],
   ['auth@notify.cresca.ai', 'Code 403862 - Confirm your email'],
   ['updates@updates.cresca.ai', 'Welcome to Cresca'],
   ['informations@xendit.co', '233543 - Your Xendit Verification Code'],
   ['support@reloadly.com', 'Welcome to Reloadly (save this email!)'],
   ['mail@signnow.com', '_Moodeng Mutual NDA .docx: Signature Request from Avinash Kumar'],
   ['mail@signnow.com', '_Moodeng Mutual NDA .docx Has Been Completed'],
   ['support@moodeng.app', 'We missed you on the call'],
   ['marketing@straitsx.com', 'Next steps for your Moodeng Credit inquiry'],
   ['no-reply-kanvvhetg6c5h9yfjxkjvq@mail.anthropic.com', 'Your receipt']
];

// People writing by hand: these must still open a ticket.
const people: Array<[string, string]> = [
   ['kushagra.singh@xoxoday.com', 'Re: New Client ID Creation for New Plum Account: Building Credit Asia LLC -'],
   ['solutions@giftaway.ph', 'Re: API access for ₱100 GrabFood eGifts (Moodeng Credit)'],
   ['avinash@stableyard.fi', 'Production Keys | Moodeng'],
   ['emery.villas@zoom.us', 'Re: Nonprofit Discount Request – Piyatam Foundation / Moodeng Credit'],
   ['chatterjee.a@a2acorp.org', 'Filipino microinfluencers and fintech trust'],
   ['maria.santos@gmail.com', 'Hindi ko ma-withdraw yung loan ko'],
   ['juan@yahoo.com', 'Re: Your Moodeng chat'],
   ['ana@gmail.com', 'How do I verify my account?']
];

Deno.test('machine mail never opens a ticket', () => {
   for (const [from, subject] of machine) assertEquals(isAutomatedEmail(from, subject, noHeaders), true, `${from} | ${subject}`);
});

Deno.test('people writing by hand still do', () => {
   for (const [from, subject] of people) assertEquals(isAutomatedEmail(from, subject, noHeaders), false, `${from} | ${subject}`);
});

Deno.test('mailing-list and auto-reply headers', () => {
   const headers = (h: Record<string, string>) => (name: string) => h[name] ?? null;
   assertEquals(isAutomatedEmail('ana@gmail.com', 'Hello', headers({ 'auto-submitted': 'auto-replied' })), true);
   assertEquals(isAutomatedEmail('ana@gmail.com', 'Hello', headers({ 'auto-submitted': 'no' })), false);
   assertEquals(isAutomatedEmail('ana@gmail.com', 'Hello', headers({ 'list-unsubscribe': '<mailto:x>' })), true);
   assertEquals(isAutomatedEmail('ana@gmail.com', 'Hello', headers({ precedence: 'bulk' })), true);
   assertEquals(isAutomatedEmail('ana@gmail.com', 'Meeting', headers({ 'content-type': 'multipart/mixed; text/calendar' })), true);
});
