import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { CONTINUE_URL, continueLinkText, verificationFollowUpText } from './messengerStatusFollowUp.ts';

Deno.test('a borrower already approved (Didit or World ID) hears their ID is already verified', () => {
   assertEquals(verificationFollowUpText({ is_didit: 'ACTIVE' })?.startsWith('✅'), true);
   assertEquals(verificationFollowUpText({ is_world_id: 'ACTIVE', is_didit: 'INACTIVE' })?.startsWith('✅'), true);
});

Deno.test('a borrower in manual review hears we will message them here', () => {
   assertEquals(verificationFollowUpText({ is_didit: 'INACTIVE', didit_id_status: 'In Review' })?.startsWith('🕐'), true);
});

Deno.test('nothing is added when there is no status to share', () => {
   assertEquals(verificationFollowUpText({}), null);
   assertEquals(verificationFollowUpText({ is_didit: 'INACTIVE', didit_id_status: 'Declined' }), null);
   assertEquals(verificationFollowUpText({ is_didit: 'INACTIVE', didit_id_status: null }), null);
});

Deno.test('borrowers who signed up in Facebook or Messenger get the continue link', () => {
   assertEquals(continueLinkText('Facebook app')?.includes(CONTINUE_URL), true);
   assertEquals(continueLinkText('Messenger app')?.includes(CONTINUE_URL), true);
});

Deno.test('everyone else gets no link', () => {
   assertEquals(continueLinkText('Chrome'), null);
   assertEquals(continueLinkText('Safari'), null);
   assertEquals(continueLinkText(null), null);
});
