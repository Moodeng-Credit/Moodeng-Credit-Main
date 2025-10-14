import { google } from 'googleapis';
import nodemailer from 'nodemailer';

const OAuth2 = google.auth.OAuth2;

const oauth2Client = new OAuth2(process.env.CLIENT_ID, process.env.CLIENT_SECRET, 'https://developers.google.com/oauthplayground');

oauth2Client.setCredentials({
   refresh_token: process.env.REFRESH_TOKEN
});

const getAccessToken = async () => {
   try {
      const { token } = await oauth2Client.getAccessToken();
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
      port: 587,
      secure: false,
      auth: {
         type: 'OAuth2',
         user: process.env.EMAIL_USER,
         clientId: process.env.CLIENT_ID,
         clientSecret: process.env.CLIENT_SECRET,
         refreshToken: process.env.REFRESH_TOKEN,
         accessToken: accessToken
      }
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

export const sendMail = async (recipientEmail: string, subject: string, message: string) => {
   const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: subject,
      text: message
   };

   try {
      const transporter = await createTransporter();
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent:', info.response);
      return { success: true, message: 'Email sent successfully!' };
   } catch (error) {
      console.error('Error sending email:', error);
      return { success: false, message: 'Error sending email', error };
   }
};
