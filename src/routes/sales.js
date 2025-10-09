// src/routes/sales.js
import express from 'express';
import Product from '../models/product.js';
import Reminder from '../models/Reminder.js';
import Sale from '../models/Sale.js';
import generateInstallments from '../utils/generateInstallments.js';
import Client from '../models/client.js';
import { sendSaleNotifications } from '../services/notifications.js';

const router = express.Router();

// criar venda
router.post('/', async (req, res) => {
  try {
    const { client, items = [], paymentType = 'avista', installmentsCount = 0, firstDueDate } = req.body;
    if (!client) return res.status(400).json({ error: 'Cliente obrigatório' });

    // valida cliente no banco
    const clientData = await Client.findById(client);
    if (!clientData) return res.status(404).json({ error: 'Cliente não encontrado' });

    let total = 0;
    const processedItems = await Promise.all(items.map(async (it) => {
      const product = it.product ? await Product.findById(it.product) : null;
      const unitPrice = typeof it.unitPrice === 'number' ? it.unitPrice : product ? product.price : 0;
      const qty = it.quantity || 1;
      const totalItem = Math.round(unitPrice * qty * 100) / 100;

      // atualizar estoque
      if (product) {
        product.stock = Math.max(0, (product.stock || 0) - qty);
        await product.save();
      }

      total += totalItem;
      return {
        product: it.product || null,
        description: it.description || (product ? product.name : ''),
        quantity: qty,
        unitPrice,
        total: totalItem,
      };
    }));

    const sale = new Sale({
      client,
      items: processedItems,
      totalAmount: Math.round(total * 100) / 100,
      paymentType,
    });

    if (paymentType === 'parcelado' && installmentsCount > 0) {
      sale.installments = generateInstallments(sale.totalAmount, installmentsCount, firstDueDate);
      sale.status = 'open';
    } else if (paymentType === 'avista') {
      sale.paidAt = new Date();
      sale.status = 'completed';
    }

    await sale.save();

    // lembretes para cada parcela (se houver)
    if (sale.installments && sale.installments.length) {
      for (const inst of sale.installments) {
        const r = new Reminder({
          sale: sale._id,
          client,
          scheduleDate: inst.dueDate,
          channel: 'whatsapp',
        });
        await r.save();
      }
    }

    // === 🔔 Enviar notificações automáticas (email + WhatsApp) ===
    try {
      await sendSaleNotifications({
        sale,
        customer: {
          name: clientData.name,
          email: clientData.email,
          phone: clientData.phone,
        },
        storeName: 'Beta Investimentos',
      });
      console.log('✅ Notificações de venda enviadas com sucesso.');
    } catch (err) {
      console.warn('⚠️ Falha ao enviar notificações:', err.message);
    }

    res.status(201).json(sale);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// marcar parcela como paga
router.post('/:id/pay', async (req, res) => {
  try {
    const { installmentNumber } = req.body;
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Venda não encontrada' });
    if (!sale.installments || sale.installments.length === 0)
      return res.status(400).json({ error: 'Sem parcelas' });

    const inst = sale.installments.find((i) => i.number === installmentNumber);
    if (!inst) return res.status(404).json({ error: 'Parcela não encontrada' });

    inst.paid = true;
    inst.paidAt = new Date();

    // remover lembrete associado
    await Reminder.updateMany({ sale: sale._id, scheduleDate: inst.dueDate }, { sent: true });

    if (sale.installments.every((i) => i.paid)) {
      sale.status = 'completed';
      sale.paidAt = new Date();
    }

    await sale.save();
    res.json(sale);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// listar vendas
router.get('/', async (req, res) => {
  const { clientId } = req.query;
  const q = {};
  if (clientId) q.client = clientId;
  const sales = await Sale.find(q)
    .sort({ createdAt: -1 })
    .populate('client')
    .populate('items.product');
  res.json(sales);
});

// obter venda específica
router.get('/:id', async (req, res) => {
  const sale = await Sale.findById(req.params.id)
    .populate('client')
    .populate('items.product');
  res.json(sale);
});

export default router;
