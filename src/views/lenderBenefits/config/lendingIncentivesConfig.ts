export interface LendingIncentiveItem {
   id: string;
   title: string;
   titleHighlight?: string;
   description: string[];
   image: {
      src: string;
      alt: string;
   };
   imagePosition: 'left' | 'right';
}

export const lendingIncentivesData: LendingIncentiveItem[] = [
   {
      id: 'flexible-investment',
      title: 'Flexible Investment Strategy',
      description: [
         'Offer USDT or USDC interest rates of 15%+',
         'Diversify across borrower groups and countries.',
         'In the future, use predictions market and loan securitization for insurance coverage.'
      ],
      image: {
         src: 'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/0bf4df8912f6f18fac9049e4662857220316dc65da028b1a2fdf9e0c000ba7e6?apiKey=054474a0b7744b6389c3319e0a9290c2',
         alt: 'Flexible Investment Strategy'
      },
      imagePosition: 'right'
   },
   {
      id: 'iou-tokens',
      title: 'Get Tokens called:',
      titleHighlight: 'IOU',
      description: [
         'Get up to 25 IOU tokens for lending to first-time borrowers, plus 1 IOU token for every $1 lent!',
         'Lend to 2nd-time borrowers, get 20 IOU tokens, etc.',
         'Lend 5 times, be invited to the Moodeng Credit DAO.'
      ],
      image: {
         src: 'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/670ee6d330b0fb68d0f19039d4d0ea038713f28b20b19e78c3f5f1bf1f087761?apiKey=e485b3dc4b924975b4554885e21242bb',
         alt: 'IOU Tokens'
      },
      imagePosition: 'left'
   },
   {
      id: 'social-impact',
      title: 'Focused Social Impact',
      description: [
         'You can fund people worldwide to access what they need for their businesses and communities, creating lasting impact where it matters most.'
      ],
      image: {
         src: 'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/4ba0049b45224958b9dda29c72308c4ad652b5ca345de5b2520d2e51d50221c8?apiKey=e485b3dc4b924975b4554885e21242bb',
         alt: 'Social Impact'
      },
      imagePosition: 'right'
   }
];
