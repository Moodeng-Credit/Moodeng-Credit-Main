import { describe, expect, it } from 'vitest';

import { isSensitiveReplayInput, maskReplayInput } from '@/lib/analytics/replayMasking';

const input = (attrs: Record<string, string> = {}): HTMLInputElement => {
   const el = document.createElement('input');
   for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
   document.body.appendChild(el);
   return el;
};

describe('session replay input masking', () => {
   it('records what borrowers type into ordinary fields', () => {
      const reason = document.createElement('textarea');
      expect(maskReplayInput('Paying my electricity bill and jeepney fare', reason)).toBe('Paying my electricity bill and jeepney fare');
      expect(maskReplayInput('juan@example.com', input({ type: 'email' }))).toBe('juan@example.com');
   });

   it('masks password fields, including after the eye toggle switches them to text', () => {
      expect(maskReplayInput('hunter2', input({ type: 'password' }))).toBe('*******');
      expect(maskReplayInput('hunter2', input({ type: 'text', 'data-ph-mask': 'true' }))).toBe('*******');
      expect(isSensitiveReplayInput(input({ autocomplete: 'current-password' }))).toBe(true);
      expect(isSensitiveReplayInput(input({ autocomplete: 'new-password' }))).toBe(true);
   });

   it('masks one-time codes and card fields', () => {
      expect(maskReplayInput('123456', input({ autocomplete: 'one-time-code' }))).toBe('******');
      expect(isSensitiveReplayInput(input({ autocomplete: 'cc-number' }))).toBe(true);
   });

   it('masks anything inside a .ph-mask container', () => {
      const wrapper = document.createElement('div');
      wrapper.className = 'ph-mask';
      const inner = document.createElement('input');
      wrapper.appendChild(inner);
      document.body.appendChild(wrapper);
      expect(isSensitiveReplayInput(inner)).toBe(true);
   });

   it('masks when there is no element to inspect', () => {
      expect(maskReplayInput('secret', undefined)).toBe('******');
   });
});
