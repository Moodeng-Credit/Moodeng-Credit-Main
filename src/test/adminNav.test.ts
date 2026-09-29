import { describe, expect, it } from 'vitest';

import { ALL_ADMIN_TABS, isAdminTab, navGroups } from '@/app/admin/adminNav';

describe('admin navigation', () => {
   const navTabs = navGroups.flatMap((group) => group.items.map((item) => item.id));

   it('puts every admin tab in exactly one sidebar area, so no tool goes missing', () => {
      expect([...navTabs].sort()).toEqual([...ALL_ADMIN_TABS].sort());
      expect(new Set(navTabs).size).toBe(navTabs.length);
   });

   it('keeps the sidebar short', () => {
      expect(navGroups.length).toBeLessThanOrEqual(7);
   });

   it('keeps existing /admin/:tab links valid', () => {
      for (const tab of ['users', 'relay', 'points', 'trust-points', 'requests', 'refunds', 'chat', 'calendar']) {
         expect(isAdminTab(tab)).toBe(true);
      }
      expect(isAdminTab('nope')).toBe(false);
   });
});
