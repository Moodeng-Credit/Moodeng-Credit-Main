import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { photoCheckLine } from './fbPhotoCheck.ts';

Deno.test('photoCheckLine names who to search for', () => {
   assertEquals(photoCheckLine('Juan Dela Cruz'), '📷 Check their Facebook photo in the Page inbox (search "Juan Dela Cruz"). Grey default picture = reject.');
});

Deno.test('photoCheckLine without a Facebook name still asks for the check', () => {
   assertEquals(photoCheckLine(null), '📷 Check their Facebook photo in the Page inbox. Grey default picture = reject.');
   assertEquals(photoCheckLine('  '), '📷 Check their Facebook photo in the Page inbox. Grey default picture = reject.');
});
