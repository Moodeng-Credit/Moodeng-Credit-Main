import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { bookedText, formatCallTime, inWindow, nearestText, pickSlot, toBookingWindow } from './whatsappBooking.ts';

// Now: Monday 26 Oct 2026, 09:00 in Jakarta (02:00 UTC).
const NOW = Date.parse('2026-10-26T02:00:00Z');
// Slot starts in UTC; Jakarta is UTC+7.
const today18 = '2026-10-26T11:00:00Z'; // Mon 18:00 WIB
const tomorrow10 = '2026-10-27T03:00:00Z'; // Tue 10:00 WIB
const tomorrow1130 = '2026-10-27T04:30:00Z'; // Tue 11:30 WIB
const tomorrow16 = '2026-10-27T09:00:00Z'; // Tue 16:00 WIB
const tomorrow20 = '2026-10-27T13:00:00Z'; // Tue 20:00 WIB
const day2_2230 = '2026-10-28T15:30:00Z'; // Wed 22:30 WIB
const past = '2026-10-26T01:00:00Z'; // Mon 08:00 WIB, before now

Deno.test('windows follow Jakarta days and parts of the day', () => {
   assert(inWindow(today18, 'today', NOW));
   assert(!inWindow(past, 'today', NOW));
   assert(inWindow(tomorrow10, 'tomorrow_morning', NOW));
   assert(!inWindow(tomorrow10, 'tomorrow_afternoon', NOW));
   assert(inWindow(tomorrow16, 'tomorrow_afternoon', NOW));
   assert(inWindow(tomorrow20, 'tomorrow_evening', NOW));
   assert(inWindow(day2_2230, 'day2_evening', NOW));
   assert(!inWindow(day2_2230, 'tomorrow_evening', NOW));
   assert(!inWindow(tomorrow10, 'other', NOW));
});

Deno.test('picks the earliest free slot in the window, or none', () => {
   const slots = [tomorrow1130, tomorrow20, tomorrow10, day2_2230];
   assertEquals(pickSlot(slots, 'tomorrow_morning', NOW), tomorrow10);
   assertEquals(pickSlot(slots, 'tomorrow_evening', NOW), tomorrow20);
   assertEquals(pickSlot(slots, 'day2_morning', NOW), null);
});

Deno.test('times read in WIB, in Bahasa Indonesia for Indonesians', () => {
   assert(formatCallTime(tomorrow10, 'id').endsWith('10:00 WIB'));
   assert(formatCallTime(tomorrow10, 'id').toLowerCase().includes('selasa'));
   assert(formatCallTime(tomorrow10, 'en').includes('Tuesday'));
});

Deno.test('the confirmation carries the time and the Zoom link', () => {
   const text = bookedText(tomorrow10, 'https://zoom.us/j/123', 'id');
   assert(text.includes('10:00 WIB'));
   assert(text.includes('https://zoom.us/j/123'));
   assert(text.includes('JADWAL'));
   assert(!bookedText(tomorrow10, null, 'en').includes('Zoom link'));
   assert(nearestText([tomorrow16], 'id').includes('16:00 WIB'));
});

Deno.test('the tapped list row maps to its window', () => {
   assertEquals(toBookingWindow('Besok pagi'), 'tomorrow_morning');
   assertEquals(toBookingWindow('  LUSA   malam '), 'day2_evening');
   assertEquals(toBookingWindow('Hari ini'), 'today');
   assertEquals(toBookingWindow('tomorrow_afternoon'), 'tomorrow_afternoon');
   assertEquals(toBookingWindow('🕘 Besok siang (12–17)'), 'tomorrow_afternoon');
   assertEquals(toBookingWindow('Waktu lain'), 'other');
   assertEquals(toBookingWindow('something else'), 'other');
});
