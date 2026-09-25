export const sendEmail = async (
   recipientEmail: string,
   subject: string,
   message: string,
   html?: string,
   cc?: string | string[]
) => {
   const resendApiKey = Deno.env.get('RESEND_API_KEY');
   const configuredFrom = Deno.env.get('RESEND_FROM')?.trim() || 'support@moodeng.app';
   // A bare address shows up in the inbox as "support", which reads like a bot. Give it a sender name.
   const resendFrom = configuredFrom.includes('<') ? configuredFrom : `Moodeng Credit <${configuredFrom}>`;

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
         // Replies reach the team even if RESEND_FROM is ever a no-reply address.
         reply_to: 'support@moodeng.app',
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
