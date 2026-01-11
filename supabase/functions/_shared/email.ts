import nodemailer from 'npm:nodemailer@7.0.11';

const getAccessToken = async () => {
   const clientId = Deno.env.get('CLIENT_ID');
   const clientSecret = Deno.env.get('CLIENT_SECRET');
   const refreshToken = Deno.env.get('REFRESH_TOKEN');

   if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Missing OAuth client credentials');
   }

   const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
         client_id: clientId,
         client_secret: clientSecret,
         refresh_token: refreshToken,
         grant_type: 'refresh_token'
      })
   });

   if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch access token: ${errorText}`);
   }

   const data = (await response.json()) as { access_token?: string };

   if (!data.access_token) {
      throw new Error('Missing access token in OAuth response');
   }

   return data.access_token;
};

const createTransporter = async () => {
   const emailUser = Deno.env.get('EMAIL_USER');

   if (!emailUser) {
      throw new Error('Missing EMAIL_USER environment variable');
   }

   const accessToken = await getAccessToken();

   return nodemailer.createTransport({
      service: 'gmail',
      auth: {
         type: 'OAuth2',
         user: emailUser,
         clientId: Deno.env.get('CLIENT_ID'),
         clientSecret: Deno.env.get('CLIENT_SECRET'),
         refreshToken: Deno.env.get('REFRESH_TOKEN'),
         accessToken
      }
   });
};

export const sendEmail = async (recipientEmail: string, subject: string, message: string) => {
   const emailUser = Deno.env.get('EMAIL_USER');

   if (!emailUser) {
      throw new Error('Missing EMAIL_USER environment variable');
   }

   const transporter = await createTransporter();

   return transporter.sendMail({
      from: emailUser,
      to: recipientEmail,
      subject,
      text: message
   });
};
