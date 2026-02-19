export interface VerifyStatsCardProps {
   title: string;
   titleColor: string;
   subtitle: string;
   description: string;
   bgImage: string;
   image: string;
}

export const VerifyStatsCardConfig: VerifyStatsCardProps[] = [
   {
      title: 'WorldId Uniqueness Pass',
      titleColor: 'text-red-400',
      subtitle: 'Borrower Facescan',
      description:
         'Borrowers must renew their WORLD ID pass every 90 days for $0.30 to keep using the platform. For loans of $15 or more, this is the minimum required verification.',
      bgImage:
         'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/145f86ad4b39d3102c79b614c82b3ded4c96c9d98f2693c91c50b1ca5bebc373?apiKey=e485b3dc4b924975b4554885e21242bb',
      image: 'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/8fd1995d2acdfc8ab1dcd8643aab40eba92360a24c0c6e2d4ced51030a0cbd0e?apiKey=054474a0b7744b6389c3319e0a9290c2'
   },
   {
      title: 'WorldId Liveness Pass',
      titleColor: 'text-purple-500',
      subtitle: 'Borrower Video Selfie',
      description:
         'Borrowers must use WorldId to record a video every 30 days to verify their identity for the Uniqueness Pass, required for loans of $40 or more.',
      bgImage:
         'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/224b7865e52beec554eb351859f9bc3aa25eb8fc44de4e79eebad47489b4a57e?apiKey=e485b3dc4b924975b4554885e21242bb',
      image: 'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/d4edc145a734f7e73101726c3447e3d65dd1bb9cef003529c846cfae8b4b45d6?apiKey=054474a0b7744b6389c3319e0a9290c2'
   },
   {
      title: 'WorldId ID Verification',
      titleColor: 'text-blue-600',
      subtitle: 'Borrower Gov IDs',
      description: 'Borrowers must submit a government-issued ID to WorldId every 30 days for loans over $100',
      bgImage:
         'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/c08911af0c417aaed164117a1e06b31693b227ecbe13345d5472de8dcac7f5f8?apiKey=e485b3dc4b924975b4554885e21242bb',
      image: 'https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/5de35a06e58efb26a7d4ad62fe42f62775272c2d3ae9b92a21784e1ea3016cc2?apiKey=054474a0b7744b6389c3319e0a9290c2'
   }
];
