// src/services/mailer.js
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.MAIL_PORT || 587),
  secure: Number(process.env.MAIL_PORT) === 465,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// teste de conexão opcional
transporter.verify().then(() => {
  console.log('Mailer ready');
}).catch(err => {
  console.warn('Mailer verify failed (ok on deploy if env not set):', err.message);
});

export async function sendMail({ to, subject, text, html }) {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.warn('MAIL_USER or MAIL_PASS not set. Skipping sendMail.');
    return;
  }
  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to,
    subject,
    text,
    html
  });
  return info;
}

export default { sendMail };
