import * as dotenvx from '@dotenvx/dotenvx';
import { google } from 'googleapis';
import nodemailer from 'nodemailer';

const OAuth2 = google.auth.OAuth2;

const oauth2Client = new OAuth2(dotenvx.get('CLIENT_ID'), dotenvx.get('CLIENT_SECRET'), 'https://developers.google.com/oauthplayground');

oauth2Client.setCredentials({
   refresh_token: dotenvx.get('REFRESH_TOKEN')
});

const getAccessToken = async () => {
   try {
      // Add 10 second timeout to OAuth token fetch
      const timeoutPromise = new Promise((_, reject) => {
         setTimeout(() => reject(new Error('OAuth token fetch timeout')), 10000);
      });

      const tokenPromise = oauth2Client.getAccessToken();
      const { token } = (await Promise.race([tokenPromise, timeoutPromise])) as { token: string | null | undefined };
      return token;
   } catch (error) {
      console.error('Error getting access token:', error);
      throw error;
   }
};

const createTransporter = async () => {
   const accessToken = await getAccessToken();

   return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587, // Use port 587 with STARTTLS instead of 465
      secure: false, // Use STARTTLS instead of SSL
      requireTLS: true,
      connectionTimeout: 30000, // Increased to 30 seconds
      greetingTimeout: 30000, // Increased to 30 seconds
      socketTimeout: 30000, // Increased to 30 seconds
      pool: true, // Use connection pooling
      maxConnections: 5,
      maxMessages: 10,
      auth: {
         type: 'OAuth2',
         user: dotenvx.get('EMAIL_USER'),
         clientId: dotenvx.get('CLIENT_ID'),
         clientSecret: dotenvx.get('CLIENT_SECRET'),
         refreshToken: dotenvx.get('REFRESH_TOKEN'),
         accessToken: accessToken
      },
      logger: true,
      debug: dotenvx.get('NODE_ENV') === 'development' // Enable debug in development
   } as nodemailer.TransportOptions);
};

export const verifyTransporter = async () => {
   try {
      const transporter = await createTransporter();
      await transporter.verify();
      console.log('Server is ready to take our messages');
      return true;
   } catch (error) {
      console.error('Error verifying transporter:', error);
      return false;
   }
};

export const sendMail = async (recipientEmail: string, subject: string, message: string, retries = 3) => {
   const mailOptions = {
      from: dotenvx.get('EMAIL_USER'),
      to: recipientEmail,
      subject: subject,
      text: message
   };

   let lastError: unknown;

   for (let attempt = 1; attempt <= retries; attempt++) {
      try {
         console.log(`Email send attempt ${attempt}/${retries} to ${recipientEmail}`);
         const transporter = await createTransporter();
         const info = await transporter.sendMail(mailOptions);
         console.log('Email sent successfully:', info.response);
         return { success: true, message: 'Email sent successfully!' };
      } catch (error) {
         lastError = error;
         console.error(`Email send attempt ${attempt}/${retries} failed:`, error);

         // Don't retry on authentication errors
         const errorObj = error as { code?: string; responseCode?: number };
         if (errorObj.code === 'EAUTH' || errorObj.responseCode === 535) {
            console.error('Authentication error - not retrying');
            break;
         }

         // Wait before retrying (exponential backoff)
         if (attempt < retries) {
            const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            console.log(`Waiting ${waitTime}ms before retry...`);
            await new Promise((resolve) => setTimeout(resolve, waitTime));
         }
      }
   }

   return {
      success: false,
      message: `Failed to send email after ${retries} attempts`,
      error: lastError
   };
};
