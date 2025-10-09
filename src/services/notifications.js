// src/services/notifications.js
import Template from '../models/MessageTemplate.js';
import { sendMail } from './mailer.js';
import { sendWhatsApp } from './whatsapp.js';

function renderTemplate(text = '', ctx = {}) {
  let out = text;
  Object.keys(ctx).forEach(k => {
    const re = new RegExp(`{{\\s*${k}\\s*}}`, 'g');
    out = out.replace(re, ctx[k] ?? '');
  });
  return out;
}

export async function sendSaleNotifications({ sale, customer, storeName = 'Minha Loja' }) {
  // carrega template; se não existir, usa mensagem padrão
  const tpl = await Template.findOne({ key: 'sale_confirmation' });
  const ctx = {
    customerName: customer.name || '',
    storeName,
    saleId: sale._id?.toString() || '',
    total: sale.total?.toString() || '',
    productList: (sale.products || []).map(p => `${p.name}${p.model ? ' ('+p.model+')' : ''}`).join(', '),
    warranty: (sale.products || []).map(p => `${p.name}: ${p.warrantyMonths || 0} meses`).join('; ')
  };

  // Email
  if ((!tpl || tpl.channel === 'email' || tpl.channel === 'both') && customer.email) {
    const subject = tpl?.subject ? renderTemplate(tpl.subject, ctx) : `Compra registrada - ${storeName}`;
    const text = tpl?.body ? renderTemplate(tpl.body, ctx) :
      `Olá ${ctx.customerName}, sua compra foi registrada. Produtos: ${ctx.productList}. Garantia: ${ctx.warranty}. Total: ${ctx.total}.`;
    try {
      await sendMail({ to: customer.email, subject, text });
    } catch (err) {
      console.warn('Error sending sale email:', err.message);
    }
  }

  // WhatsApp
  if ((!tpl || tpl.channel === 'whatsapp' || tpl.channel === 'both') && customer.phone) {
    const text = tpl?.body ? renderTemplate(tpl.body, ctx) :
      `Olá ${ctx.customerName}, sua compra foi registrada. Produtos: ${ctx.productList}. Garantia: ${ctx.warranty}.`;
    try {
      await sendWhatsApp({ toPhone: customer.phone, body: text });
    } catch (err) {
      console.warn('Error sending sale whatsapp:', err.message);
    }
  }
}

export async function sendInstallmentReminder({ customer, debt, storeName = 'Minha Loja' }) {
  const tpl = await Template.findOne({ key: 'installment_reminder' });
  const ctx = {
    customerName: customer.name || '',
    amount: (debt.amount ?? '').toString(),
    dueDate: new Date(debt.dueDate).toLocaleDateString(),
    saleId: debt.saleId?.toString() || '',
    storeName
  };

  if ((!tpl || tpl.channel === 'email' || tpl.channel === 'both') && customer.email) {
    const subject = tpl?.subject ? renderTemplate(tpl.subject, ctx) : `Lembrete de pagamento - ${storeName}`;
    const text = tpl?.body ? renderTemplate(tpl.body, ctx) :
      `Olá ${ctx.customerName}, sua parcela de R$ ${ctx.amount} vence em ${ctx.dueDate}.`;
    try {
      await sendMail({ to: customer.email, subject, text });
    } catch (err) {
      console.warn('Error sending reminder email:', err.message);
    }
  }

  if ((!tpl || tpl.channel === 'whatsapp' || tpl.channel === 'both') && customer.phone) {
    const text = tpl?.body ? renderTemplate(tpl.body, ctx) :
      `Olá ${ctx.customerName}, sua parcela de R$ ${ctx.amount} vence em ${ctx.dueDate}.`;
    try {
      await sendWhatsApp({ toPhone: customer.phone, body: text });
    } catch (err) {
      console.warn('Error sending reminder whatsapp:', err.message);
    }
  }
}

export default { sendSaleNotifications, sendInstallmentReminder };
