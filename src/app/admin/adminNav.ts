// The admin panel's navigation: every tab (each is an /admin/:tab URL) and the sidebar areas that
// group them. Kept out of page.tsx so tests can check every tab stays reachable.

export type AdminTab =
   | 'users'
   | 'calendar'
   | 'analytics'
   | 'ux-health'
   | 'on-chain'
   | 'loans'
   | 'pricing'
   | 'coming-due'
   | 'extensions'
   | 'points'
   | 'trust-points'
   | 'defaults'
   | 'requests'
   | 'refunds'
   | 'risk'
   | 'self-lending'
   | 'mule-risk'
   | 'referrals'
   | 'borrower-contacts'
   | 'notifications'
   | 'chat'
   | 'relay'
   | 'demo-platform'
   | 'demo-b2c-dashboard'
   | 'demo-b2c-assets'
   | 'demo-monday'
   | 'demo-map'
   | 'demo-console'
   | 'demo-spec';

export type NavGroup = { id: string; label: string; items: Array<{ id: AdminTab; label: string }> };

// Six areas in the sidebar; each area's tools are sub-tabs along the top of the page (Stripe-style).
// Tab ids — and so /admin/:tab URLs — are unchanged, so old links still land on the right tool.
export const navGroups: NavGroup[] = [
   {
      id: 'people',
      label: 'People',
      items: [
         { id: 'users', label: 'Directory' },
         { id: 'borrower-contacts', label: 'Borrower contacts' }
      ]
   },
   {
      id: 'loans',
      label: 'Loans',
      items: [
         { id: 'loans', label: 'All loans' },
         { id: 'requests', label: 'Requests' },
         { id: 'coming-due', label: 'Coming due' },
         { id: 'extensions', label: 'Extensions' },
         { id: 'refunds', label: 'Refunds' },
         { id: 'defaults', label: 'Defaults' },
         { id: 'pricing', label: 'Pricing' }
      ]
   },
   {
      id: 'risk',
      label: 'Risk',
      items: [
         { id: 'risk', label: 'Assessment' },
         { id: 'self-lending', label: 'Self-lending' },
         { id: 'mule-risk', label: 'Mule risk' }
      ]
   },
   {
      id: 'growth',
      label: 'Growth',
      items: [
         { id: 'analytics', label: 'Analytics' },
         { id: 'ux-health', label: 'UX health' },
         { id: 'on-chain', label: 'On-chain' },
         { id: 'referrals', label: 'Referrals' },
         { id: 'notifications', label: 'Notifications' },
         { id: 'points', label: 'IOU points' },
         { id: 'trust-points', label: 'Pandesal points' }
      ]
   },
   {
      id: 'support',
      label: 'Support',
      items: [
         { id: 'chat', label: 'Live chat' },
         { id: 'calendar', label: 'Calendar' }
      ]
   },
   {
      id: 'more',
      label: 'More',
      items: [
         { id: 'relay', label: 'Liquidity Relay' },
         { id: 'demo-platform', label: 'B2B demo' },
         { id: 'demo-b2c-dashboard', label: 'B2C dashboard demo' },
         { id: 'demo-b2c-assets', label: 'B2C asset pack' },
         { id: 'demo-monday', label: 'Old demo: Monday problem' },
         { id: 'demo-map', label: 'Old demo: Pool map' },
         { id: 'demo-console', label: 'Old demo: Facility console' },
         { id: 'demo-spec', label: 'Old demo: Build spec' }
      ]
   }
];

export const ALL_ADMIN_TABS: readonly AdminTab[] = [
   'users',
   'calendar',
   'analytics',
   'ux-health',
   'on-chain',
   'loans',
   'pricing',
   'coming-due',
   'extensions',
   'points',
   'trust-points',
   'defaults',
   'requests',
   'refunds',
   'risk',
   'self-lending',
   'mule-risk',
   'referrals',
   'borrower-contacts',
   'notifications',
   'chat',
   'relay',
   'demo-platform',
   'demo-b2c-dashboard',
   'demo-b2c-assets',
   'demo-monday',
   'demo-map',
   'demo-console',
   'demo-spec'
];

export function isAdminTab(value: string): value is AdminTab {
   return (ALL_ADMIN_TABS as readonly string[]).includes(value);
}
