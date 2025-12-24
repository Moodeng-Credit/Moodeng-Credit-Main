import { type JSX } from 'react';

export default function OurPartnershipsSection(): JSX.Element {
   const partnerships = [
      {
         title: 'SE Asia Emergency Care',
         description: 'Financing specialized treatments beyond national insurance coverage.',
         image: 'https://c.animaapp.com/VPWnEuWR/img/bhuffxoht5iphbxiuetlkq-1@2x.png',
         bgImage: 'https://c.animaapp.com/VPWnEuWR/img/oc5ihvkd00fsn0qmlc6hzjznhr4-png.png',
      },
      {
         title: 'Water for Villages',
         description: 'Funding sustainable village water infrastructure through community microloans.',
         image: 'https://c.animaapp.com/VPWnEuWR/img/zos6wu-vqxmis3hal4rcmw-1@2x.png',
         bgImage: 'https://c.animaapp.com/VPWnEuWR/img/w9x50d87osjpkpgb13iezxh7hrk-png.png',
      },
      {
         title: 'School Supplies in India',
         description: 'Helping families get school essentials',
         image: 'https://c.animaapp.com/VPWnEuWR/img/7aqdnt6vq8exm24qil9ena-1@2x.png',
         bgImage: 'https://c.animaapp.com/VPWnEuWR/img/dif6wuh3iykdpw6pe0iyq7z6elo-png.png',
      },
   ];

   return (
      <div className="w-full px-4 md:px-8 lg:px-16 py-12 md:py-16 lg:py-20">
         <div className="max-w-7xl mx-auto">
            {/* Header */}
            <h2 className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#f6f6f6] text-3xl md:text-4xl tracking-[0] leading-8 mb-12 md:mb-16">
               OUR PARTNERSHIPS
            </h2>

            {/* Partnership Cards Grid */}
            <div className="grid grid-cols-1 gap-8 md:gap-12 lg:gap-16">
               {partnerships.map((partnership, index) => (
                  <div key={index} className="rounded-[30px] md:rounded-[40px] overflow-hidden bg-[#f6f6f6] grid grid-cols-1 md:grid-cols-2">
                     {/* Image Section */}
                     <div className="h-64 md:h-80 lg:h-96 relative bg-cover bg-center"
                          style={{backgroundImage: `url(${partnership.bgImage})`}}>
                        <img
                           className="w-full h-full object-cover"
                           alt={partnership.title}
                           src={partnership.image}
                        />
                     </div>

                     {/* Content Section */}
                     <div className="p-6 md:p-8 lg:p-10 flex flex-col justify-center">
                        <div className="text-[#582cd6] text-lg md:text-xl tracking-[0] leading-8 font-normal mb-4">
                           GIVE HELP
                        </div>
                        <h3 className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-2xl md:text-3xl lg:text-4xl tracking-[0] leading-[42px] mb-4 md:mb-6">
                           {partnership.title}
                        </h3>
                        <p className="[font-family:'PP_Telegraf-Regular',Helvetica] font-normal text-[#171420] text-base md:text-lg tracking-[0] leading-8 mb-6 md:mb-8">
                           {partnership.description}
                        </p>
                        <button className="bg-[#ff9900] rounded-full px-8 py-3 text-[#171420] font-normal text-lg hover:bg-orange-500 transition-colors w-fit">
                           Read more
                        </button>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </div>
   );
}
