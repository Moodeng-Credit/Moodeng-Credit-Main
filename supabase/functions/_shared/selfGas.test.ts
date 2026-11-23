import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { parseSelfGasConfig, userSelfPays } from './selfGas.ts';

Deno.test('missing or broken setting is off', () => {
   assertEquals(parseSelfGasConfig(null).mode, 'off');
   assertEquals(parseSelfGasConfig('nope').mode, 'off');
   assertEquals(parseSelfGasConfig('{"mode":"yes"}').mode, 'off');
});

Deno.test('test mode only covers listed users', () => {
   const cfg = parseSelfGasConfig('{"mode":"test","user_ids":["a",1]}');
   assertEquals(cfg.userIds, ['a']);
   assertEquals(userSelfPays(cfg, 'a'), true);
   assertEquals(userSelfPays(cfg, 'b'), false);
});

Deno.test('all mode covers everyone; off covers no one', () => {
   assertEquals(userSelfPays(parseSelfGasConfig('{"mode":"all"}'), 'x'), true);
   assertEquals(userSelfPays(parseSelfGasConfig('{"mode":"off","user_ids":["x"]}'), 'x'), false);
});

Deno.test('wei knobs accept digit strings, fall back otherwise', () => {
   const cfg = parseSelfGasConfig('{"mode":"all","min_wei":"5","drip_wei":"-1","per_user_daily":2}');
   assertEquals(cfg.minWei, 5n);
   assertEquals(cfg.dripWei, 30_000_000_000_000n);
   assertEquals(cfg.perUserDaily, 2);
   assertEquals(cfg.globalDaily, 60);
});
