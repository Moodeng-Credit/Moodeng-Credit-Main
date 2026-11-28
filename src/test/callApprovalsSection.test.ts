import { act, createElement } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AdminCallApprovalRow } from '@/app/admin/adminSupabase';

type ReactActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
(globalThis as ReactActGlobal).IS_REACT_ACT_ENVIRONMENT = true;

const api = vi.hoisted(() => ({ rows: [] as unknown[], decide: vi.fn() }));

vi.mock('@/app/admin/adminSupabase', () => ({
   getAdminCallApprovals: async () => api.rows,
   decideAdminCall: api.decide,
   rejectAdminUser: vi.fn(),
   getAdminCallFaces: async (ids: string[]) =>
      Object.fromEntries(ids.map((id) => [id, { avatar: id === 'next' ? 'https://example.com/next.jpg' : null, clip: null, photos: [] }]))
}));
vi.mock('@/app/admin/indonesiaAdmin', () => ({
   fetchIndonesiaProfiles: async () => new Map(),
   telegramUrl: () => null,
   whatsappChatUrl: () => null
}));
vi.mock('@/app/admin/useAdminLive', () => ({ useAdminLiveReload: () => undefined }));
vi.mock('@/app/admin/CallBrief', () => ({ default: ({ userId }: { userId: string }) => createElement('div', { 'data-brief': userId }) }));
vi.mock('@/app/admin/CallSheet', () => ({ default: ({ row }: { row: AdminCallApprovalRow }) => createElement('div', { 'data-sheet': row.userId }) }));

const { default: CallApprovalsSection } = await import('@/app/admin/CallApprovalsSection');

// Noon local time, so "today" has room on both sides.
const NOON = new Date(2026, 9, 10, 12, 0, 0).getTime();
const at = (minFromNoon: number) => new Date(NOON + minFromNoon * 60000).toISOString();
const row = (over: Partial<AdminCallApprovalRow>): AdminCallApprovalRow => ({
   userId: 'u',
   name: 'Test Person',
   username: null,
   loanAccessStatus: 'none',
   callStartsAt: null,
   host: 'emma',
   joinUrl: 'https://example.com/call',
   attendance: null,
   outcome: null,
   outcomeAt: null,
   request: null,
   ...over
});

let host: HTMLDivElement;
let root: Root;
const mount = async () => {
   await act(async () => {
      root.render(createElement(MemoryRouter, null, createElement(CallApprovalsSection)));
   });
   await act(async () => {
      await Promise.resolve();
   });
};
const order = () => Array.from(host.querySelectorAll('[data-flip]')).map((el) => el.getAttribute('data-flip'));
const card = (id: string) => host.querySelector(`#call-${id}`) as HTMLElement;

beforeEach(() => {
   vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
   vi.setSystemTime(NOON);
   host = document.createElement('div');
   document.body.appendChild(host);
   root = createRoot(host);
   api.rows = [
      row({ userId: 'later', name: 'Later Lina · @later · later@example.com', callStartsAt: at(120) }),
      row({ userId: 'live', name: 'Live Leo · @live · live@example.com', callStartsAt: at(-5) }),
      row({ userId: 'next', name: 'Next Nina · @next · next@example.com', callStartsAt: at(30) }),
      row({ userId: 'done', name: 'Done Dan · @done · done@example.com', callStartsAt: at(-90), outcome: 'attended', outcomeAt: at(-70) })
   ];
});

afterEach(() => {
   act(() => root.unmount());
   host.remove();
   vi.useRealTimers();
});

describe('CallApprovalsSection (Calls screen)', () => {
   it('shows one host\'s calls when picked, and remembers it', async () => {
      api.rows = (api.rows as AdminCallApprovalRow[]).map((r) => (r.userId === 'next' ? { ...r, host: 'george' } : r));
      await mount();
      expect(order()).toEqual(['live', 'next', 'later']);
      const george = Array.from(host.querySelectorAll('[role="group"] button')).find((b) => b.textContent === 'george') as HTMLButtonElement;
      await act(async () => {
         george.click();
      });
      expect(order()).toEqual(['next']);
      expect(card('next').textContent).toContain('Up next');
      expect((host.querySelector('aside') as HTMLElement).textContent).toContain('1 call · 1 to go');
      expect(window.localStorage.getItem('moodeng_admin_calls_host')).toBe('george');
      window.localStorage.removeItem('moodeng_admin_calls_host');
   });

   it('shows the call on now, then the next one, then the rest', async () => {
      await mount();
      expect(order()).toEqual(['live', 'next', 'later']);
      expect(card('live').textContent).toContain('On now');
      expect(card('live').textContent).toContain('Live Leo');
      expect(card('live').textContent).toContain('Showed up');
      expect(card('next').textContent).toContain('Up next');
      // Their picture when we have one, their initial when we don't.
      expect(card('next').querySelector('img')?.getAttribute('src')).toBe('https://example.com/next.jpg');
      expect(card('later').querySelector('img')).toBeNull();
      // The brief is written for the people at the top only.
      expect(Array.from(host.querySelectorAll('[data-brief]')).map((el) => el.getAttribute('data-brief'))).toEqual(['live', 'next']);
      // The next call shows its decision buttons and a way to the full profile without opening anything.
      expect(card('next').textContent).toContain('Showed up');
      expect(card('next').textContent).toContain('Reject');
      expect(Array.from(card('next').querySelectorAll('a[href="/admin/user/next"]')).some((a) => a.textContent?.includes('Full profile'))).toBe(true);
      // Later calls are one line: short name only, no email.
      expect(card('later').textContent).toContain('Later Lina');
      expect(card('later').textContent).not.toContain('later@example.com');
   });

   it("lists the whole day on the schedule, finished calls included", async () => {
      await mount();
      const schedule = host.querySelector('aside') as HTMLElement;
      expect(schedule.textContent).toContain('Today');
      expect(schedule.textContent).toContain('4 calls · 3 to go');
      const names = Array.from(schedule.querySelectorAll('ol button')).map((b) => b.textContent ?? '');
      expect(names.map((n) => (n.match(/Done Dan|Live Leo|Next Nina|Later Lina/) ?? [''])[0])).toEqual(['Done Dan', 'Live Leo', 'Next Nina', 'Later Lina']);
      expect(names[0]).toContain('Approved');
      expect(names[1]).toContain('On now');
      expect(names[2]).toContain('Up next');
   });

   it('moves a call up the line when its time changes, and says so', async () => {
      await mount();
      api.rows = (api.rows as AdminCallApprovalRow[]).map((r) => (r.userId === 'later' ? { ...r, callStartsAt: at(15) } : r));
      await act(async () => {
         vi.advanceTimersByTime(30000);
         await Promise.resolve();
      });
      await act(async () => {
         await Promise.resolve();
      });
      expect(order()).toEqual(['live', 'later', 'next']);
      expect(card('later').textContent).toContain('Up next');
      expect(card('later').textContent).toContain('Time changed');
   });
});
