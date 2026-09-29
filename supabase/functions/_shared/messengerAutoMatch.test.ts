import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { decideAutoMatch, handleLetters, nameMatchStrength, nameTokens, type OpenAttempt } from './messengerAutoMatch.ts';

const T0 = Date.parse('2026-09-29T07:22:25Z');
const min = 60 * 1000;

const aya: OpenAttempt = {
   code: 'MDNG-3D66AD',
   user_id: 'aya',
   created_at: '2026-09-29T07:22:25Z',
   names: ['aya albaracin', 'AYA M ALBARRACIN', 'ayaalbaracin97@gmail.com', 'ayaalbaracin97-b5e3f9']
};

Deno.test('name helpers: accents, initials, digits and the username suffix', () => {
   assertEquals(nameTokens('Aya M. Albarracín'), ['aya', 'albarracin']);
   assertEquals(handleLetters('ayaalbaracin97-b5e3f9'), 'ayaalbaracin');
   assertEquals(handleLetters('ayaalbaracin97@gmail.com'), 'ayaalbaracin');
});

Deno.test('Aya: Facebook "Aya Albarracin" vs app "aya albaracin" is a strong match', () => {
   assertEquals(nameMatchStrength('Aya Albarracin', ['aya albaracin']), 'strong');
   // Even with only the run-together email handle to go on.
   assertEquals(nameMatchStrength('Aya Albarracin', ['ayaalbaracin97@gmail.com']), 'strong');
});

Deno.test('first name only is weak; a different person is none', () => {
   assertEquals(nameMatchStrength('Aya Santos', aya.names), 'weak');
   assertEquals(nameMatchStrength('Brian Christian Pasikatan', aya.names), 'none');
   assertEquals(nameMatchStrength('', aya.names), 'none');
   // A one-word Facebook name can never be strong on tokens alone.
   assertEquals(nameMatchStrength('Aya', ['Aya Albarracin']), 'weak');
});

Deno.test('short names must match exactly — "Ana" is not "Ava"', () => {
   assertEquals(nameMatchStrength('Ana Cruz', ['Ava Cruz']), 'weak');
});

Deno.test('decide: one strong match in the window → auto', () => {
   const d = decideAutoMatch('Aya Albarracin', T0 + 20_000, [aya]);
   assertEquals(d, { kind: 'auto', attempt: aya });
});

Deno.test('decide: outside the 30-minute window → none', () => {
   assertEquals(decideAutoMatch('Aya Albarracin', T0 + 31 * min, [aya]), { kind: 'none' });
   assertEquals(decideAutoMatch('Aya Albarracin', T0 - 5 * min, [aya]), { kind: 'none' });
   // A little early is fine (clock skew).
   assertEquals(decideAutoMatch('Aya Albarracin', T0 - 1 * min, [aya]).kind, 'auto');
});

Deno.test('decide: two strong matches → ask the team, never guess', () => {
   const twin = { ...aya, user_id: 'twin', code: 'MDNG-000001', names: ['Aya Albarracin'] };
   const d = decideAutoMatch('Aya Albarracin', T0 + min, [aya, twin]);
   assertEquals(d.kind, 'suggest');
   assertEquals(d.kind === 'suggest' ? d.attempts.map((a) => a.user_id) : [], ['aya', 'twin']);
});

Deno.test('decide: only weak matches → suggest; nobody → none', () => {
   assertEquals(decideAutoMatch('Aya Santos', T0 + min, [aya]).kind, 'suggest');
   assertEquals(decideAutoMatch('Pedro Reyes', T0 + min, [aya]), { kind: 'none' });
});
