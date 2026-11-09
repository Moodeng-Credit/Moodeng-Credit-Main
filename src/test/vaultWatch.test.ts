import { describe, expect, it } from 'vitest';

import { assessVault, type VaultSnapshot } from '../../supabase/functions/_shared/vaultWatch';

const snap = (over: Partial<VaultSnapshot> = {}): VaultSnapshot => ({
   principalOut: 0,
   cover: 50,
   available: 500,
   paused: false,
   operatorCanDraw: true,
   recordedPrincipal: 0,
   recordedLoans: 0,
   ...over
});

describe('vault watch', () => {
   it('is quiet when nothing changed', () => {
      const first = assessVault(snap(), null);
      expect(first.findings).toEqual([]);
      expect(assessVault(snap(), first.state).findings).toEqual([]);
   });

   it('posts an info line for our own recorded draw', () => {
      const before = assessVault(snap(), null).state;
      const { findings } = assessVault(snap({ principalOut: 20, recordedPrincipal: 20, recordedLoans: 1, available: 480 }), before);
      expect(findings).toHaveLength(1);
      expect(findings[0].severity).toBe('info');
      expect(findings[0].title).toContain('20.00 USDC lent');
   });

   it('waits one run before alarming on an unrecorded draw (recording lag), then goes critical', () => {
      const before = assessVault(snap(), null).state;
      const drawnNotRecorded = snap({ principalOut: 500, available: 0 });
      const firstSight = assessVault(drawnNotRecorded, before);
      expect(firstSight.findings.some((f) => f.severity === 'critical')).toBe(false);
      const second = assessVault(drawnNotRecorded, firstSight.state);
      expect(second.findings).toHaveLength(1);
      expect(second.findings[0].severity).toBe('critical');
      expect(second.findings[0].title).toContain('500.00 USDC drawn that matches no Moodeng loan');
   });

   it('clears when the draw gets recorded in time', () => {
      const before = assessVault(snap(), null).state;
      const lag = assessVault(snap({ principalOut: 20, available: 480 }), before).state;
      const recorded = assessVault(snap({ principalOut: 20, recordedPrincipal: 20, recordedLoans: 1, available: 480 }), lag);
      expect(recorded.findings.some((f) => f.severity === 'critical')).toBe(false);
      expect(recorded.state.unrecorded).toBe(0);
   });

   it('flags cover going down, a pause, and a lost draw permission', () => {
      const before = assessVault(snap(), null).state;
      const titles = assessVault(snap({ cover: 0, paused: true, operatorCanDraw: false }), before).findings.map((f) => f.title);
      expect(titles).toEqual([
         'Vault: our cover dropped from 50.00 USDC to 0.00 USDC',
         'Vault: BitRepo paused draws',
         'Vault: our lending wallet lost its draw permission'
      ]);
   });

   it('does not repeat the pause alert every run', () => {
      const paused = assessVault(snap({ paused: true }), assessVault(snap(), null).state).state;
      expect(assessVault(snap({ paused: true }), paused).findings).toEqual([]);
   });
});
