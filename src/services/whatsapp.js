// src/services/whatsapp.js
import twilio from 'twilio';

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_WHATSAPP_FROM; // ex: whatsapp:+1415...

let client = null;
if (SID && TOKEN) client = twilio(SID, TOKEN);

export async function sendWhatsApp({ toPhone, body }) {
  if (!client) {
    console.warn('Twilio not configured. Skipping WhatsApp send.');
    return;
  }
  if (!FROM) {
    console.warn('TWILIO_WHATSAPP_FROM not set. Skipping WhatsApp send.');
    return;
  }
  // toPhone deve estar em E.164 sem "whatsapp:" prefix; Twilio exige "whatsapp:+55..."
  const to = toPhone.startsWith('whatsapp:') ? toPhone : `whatsapp:${toPhone}`;
  try {
    const msg = await client.messages.create({
      from: FROM,
      to,
      body
    });
    return msg;
  } catch (err) {
    console.warn('Error sending WhatsApp:', err.message);
    throw err;
  }
}

export default { sendWhatsApp };
