export interface PartnerLogoType {
   name: string;
   src: string;
   alt: string;
   width?: number;
   height?: number;
   className?: string;
}

export interface PartnerSection {
   title: string;
   partners: PartnerLogoType[];
   stats: {
      number: string;
      label: string;
      avatars: string[];
   };
}
