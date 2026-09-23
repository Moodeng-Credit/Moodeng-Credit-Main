// Login-feed risk levels for record-session-ip (see the comment there). Kept in _shared so the
// classification is unit-testable without booting the edge function.
export const LOGIN_COLOR = { clean: 0x2ecc71, caution: 0xf39c12, risk: 0xe74c3c } as const;

const plural = (n: number) => `${n} other account${n === 1 ? '' : 's'}`;

export const classifyLogin = (isHosting: boolean, sharedSubnetUsers: number) => {
   if (!isHosting && sharedSubnetUsers > 0) {
      return {
         level: 'risk' as const,
         flags: [`🔴 Same home/mobile network as ${plural(sharedSubnetUsers)} — possible multiple accounts`]
      };
   }
   if (isHosting) {
      const flags = ['🟠 VPN / datacenter IP — hides their real location (caution, not proof of fraud)'];
      if (sharedSubnetUsers > 0) {
         flags.push(`🟠 Same VPN address as ${plural(sharedSubnetUsers)} — weak signal, VPN addresses are shared by strangers`);
      }
      return { level: 'caution' as const, flags };
   }
   return { level: 'clean' as const, flags: [] as string[] };
};
