export const sendEmail = async (
   recipientEmail: string,
   subject: string,
   message: string,
   html?: string,
   cc?: string | string[]
) => {
   const resendApiKey = Deno.env.get('RESEND_API_KEY');
   const resendFrom = Deno.env.get('RESEND_FROM') || 'support@moodeng.app';

   if (!resendApiKey) {
      throw new Error('Missing RESEND_API_KEY environment variable');
   }

   const ccList = cc ? (Array.isArray(cc) ? cc : [cc]).filter((addr) => addr?.trim()) : [];

   const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json',
         Authorization: `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
         from: resendFrom,
         to: [recipientEmail],
         subject: subject,
         text: message,
         ...(html ? { html } : {}),
         ...(ccList.length ? { cc: ccList } : {})
      })
   });

   if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send email via Resend: ${errorText}`);
   }

   return await response.json();
};
