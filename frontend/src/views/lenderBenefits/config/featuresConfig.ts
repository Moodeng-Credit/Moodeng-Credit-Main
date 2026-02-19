export interface FeaturesConfigProps {
   title: string;
   description: string;
}

export const featuresConfig: FeaturesConfigProps[] = [
   {
      title: 'Anonymous Lending',
      description: 'Wallet-based lending with usernames means no one knows your identity.'
   },
   {
      title: 'No Fees for Lenders, Ever',
      description: "Unlike other platforms, we don't charge lenders any commissions or monthly fees."
   },
   {
      title: 'Advanced Security',
      description: 'Protection against VPN-users, scammers, and other malicious actors.'
   },
   {
      title: 'Borrower Transaction History 100% Transparent',
      description: 'See all past and current loans that borrowers have.'
   },
   {
      title: 'Recurring Verification to Prove Borrower is Real',
      description:
         'Unlike Tradfi apps where accounts are borrowed/shared/sold to family/friends, here there is constant verification of the borrower.'
   },
   {
      title: 'Data Protected',
      description:
         'Web3 wallet-based lending ensures privacy: Your identity stays secure. No cookies, data selling, or spam. Just anonymous transactions.'
   }
];
