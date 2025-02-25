import nodemailer from 'nodemailer';
import { mailTemplate } from "../utils/emailTemplate";

export const sendEmailNotification = async (): Promise<void> => {
  console.log("Hello Called Node Mailer")
  const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: 'alessandra.wisoky41@ethereal.email',
      pass: '6Qm8p5RcsVcyETSYZV'
    }
  });

  // Setup email data.
  const mailOptions = {
    from: 'alessandra.wisoky41@ethereal.email',
    to: 'donald.k@appwrk.com',
    subject: 'New Calendar Event Created',
    html: mailTemplate()
  };
  await transporter.sendMail(mailOptions);
};
