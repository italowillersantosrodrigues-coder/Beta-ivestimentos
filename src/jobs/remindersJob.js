// src/jobs/remindersJob.js
import cron from 'node-cron';
import Customer from '../models/client.js'; // aparentemente seu model chama client.js
import { sendInstallmentReminder } from '../services/notifications.js';

function startJob() {
  // roda todo dia às 08:00
  const task = cron.schedule('0 8 * * *', async () => {
    try {
      const lookahead = Number(process.env.REMINDER_LOOKAHEAD_DAYS || 1);
      const today = new Date();
      today.setHours(0,0,0,0);

      // vamos verificar para os próximos `lookahead` dias inclusive hoje
      for (let i = 0; i <= lookahead; i++) {
        const d0 = new Date(today);
        d0.setDate(d0.getDate() + i);
        const d1 = new Date(d0);
        d1.setDate(d1.getDate() + 1);

        // buscar clientes que tenham debts com dueDate dentro desse dia
        const customers = await Customer.find({ 'debts.dueDate': { $gte: d0, $lt: d1 } });
        for (const cust of customers) {
          const debtsDay = (cust.debts || []).filter(d => {
            const dd = new Date(d.dueDate);
            return dd >= d0 && dd < d1 && d.status === 'open';
          });
          for (const debt of debtsDay) {
            // se i === 0 => aviso no dia; se i === 1 => aviso 1 dia antes
            try {
              await sendInstallmentReminder({ customer: cust, debt, storeName: process.env.MAIL_FROM || 'Minha Loja' });
            } catch (err) {
              console.warn('Erro ao enviar lembrete para', cust._id, err.message);
            }
          }
        }
      }
    } catch (err) {
      console.error('Erro no reminders job:', err);
    }
  }, { scheduled: true, timezone: 'America/Sao_Paulo' });

  task.start();
  console.log('Reminders job started');
  return task;
}

export default { start: startJob };
