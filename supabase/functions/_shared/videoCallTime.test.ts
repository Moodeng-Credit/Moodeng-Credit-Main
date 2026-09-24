import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { formatCallTime, formatCallTimeForTeam } from './videoCall.ts';

const CALL = '2026-09-25T03:00:00.000Z'; // 10:00 Bangkok · 11:00 Manila

Deno.test("borrower messages show the call in the borrower's own zone, named", () => {
   assertEquals(formatCallTime(CALL, 'Asia/Manila'), 'Fri, Sep 25, 11:00 AM (Manila time)');
});

Deno.test('borrower messages fall back to Bangkok for a missing or bogus zone', () => {
   assertEquals(formatCallTime(CALL, null), 'Fri, Sep 25, 10:00 AM (Bangkok time)');
   assertEquals(formatCallTime(CALL, 'Not/AZone'), 'Fri, Sep 25, 10:00 AM (Bangkok time)');
});

Deno.test("team cards show Bangkok plus the borrower's clock when it differs", () => {
   assertEquals(formatCallTimeForTeam(CALL, 'Asia/Manila'), 'Fri, Sep 25, 10:00 AM (Bangkok time) · 11:00 AM their time (Manila)');
});

Deno.test('team cards name the day when the borrower is on a different date', () => {
   // 10:00 Bangkok Fri = 20:00 Thu in Los Angeles.
   assertEquals(formatCallTimeForTeam(CALL, 'America/Los_Angeles'), 'Fri, Sep 25, 10:00 AM (Bangkok time) · Thu 8:00 PM their time (Los Angeles)');
});

Deno.test('team cards stay short when the borrower shares our clock or zone is unknown', () => {
   assertEquals(formatCallTimeForTeam(CALL, 'Asia/Bangkok'), 'Fri, Sep 25, 10:00 AM (Bangkok time)');
   assertEquals(formatCallTimeForTeam(CALL, 'Asia/Jakarta'), 'Fri, Sep 25, 10:00 AM (Bangkok time)');
   assertEquals(formatCallTimeForTeam(CALL, null), 'Fri, Sep 25, 10:00 AM (Bangkok time)');
   assertEquals(formatCallTimeForTeam(CALL, 'Not/AZone'), 'Fri, Sep 25, 10:00 AM (Bangkok time)');
});
