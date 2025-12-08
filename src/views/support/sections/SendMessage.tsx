import InputField from '@/views/support/components/InputField';
import RadioField from '@/views/support/components/RadioField';
import Section from '@/views/support/components/Section';

export default function SendMessage() {
   return (
      <Section
         header=<span>
            Send us a <br className="hidden lg:block" /> Message!
         </span>
         content={
            <div className=" flex flex-col gap-8 text-base">
               <div className="grid grid-cols-2 gap-8">
                  <InputField label="First Name" placeholder="John" />
                  <InputField label="Last Name" placeholder="Doe" />
                  <InputField label="Email" placeholder="john.doe@example.com" />
                  <InputField label="Phone Number" placeholder="(+63) 000 000 0000" />
               </div>
               <div className="flex flex-col gap-4">
                  <div className="text-blue-600 font-medium">Select Subject?</div>
                  <div className="flex flex-wrap gap-y-4 gap-x-8">
                     <RadioField label="General Inquiry" name="subject" />
                     <RadioField label="Account" name="subject" />
                     <RadioField label="Transaction" name="subject" />
                     <RadioField label="Others" name="subject" />
                  </div>
               </div>

               <InputField label="Message" placeholder="Write your message.." />
               <div className="flex justify-end pt-4">
                  <button className="bg-blue-600 text-white px-10 py-3 rounded-md">Send Message</button>
               </div>
            </div>
         }
         bg
      />
   );
}
