import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { verificationFollowUpText } from './messengerStatusFollowUp.ts';

Deno.test('a borrower already approved (Didit or World ID) hears they are all set', () => {
   assertEquals(verificationFollowUpText({ is_didit: 'ACTIVE' })?.startsWith('🎉'), true);
   assertEquals(verificationFollowUpText({ is_world_id: 'ACTIVE', is_didit: 'INACTIVE' })?.startsWith('🎉'), true);
});

Deno.test('a borrower in manual review hears we will message them here', () => {
   assertEquals(verificationFollowUpText({ is_didit: 'INACTIVE', didit_id_status: 'In Review' })?.startsWith('🕐'), true);
});

Deno.test('nothing is added when there is no status to share', () => {
   assertEquals(verificationFollowUpText({}), null);
   assertEquals(verificationFollowUpText({ is_didit: 'INACTIVE', didit_id_status: 'Declined' }), null);
   assertEquals(verificationFollowUpText({ is_didit: 'INACTIVE', didit_id_status: null }), null);
});
