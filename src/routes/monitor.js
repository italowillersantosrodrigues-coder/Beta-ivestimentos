// src/routes/monitor.js
import express from 'express';
import Customer from '../models/client.js'; // ajuste conforme nome real
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { date } = req.query; // YYYY-MM-DD
    if (!date) return res.status(400).json({ error: 'date required' });
    const d0 = new Date(date);
    d0.setHours(0,0,0,0);
    const d1 = new Date(d0); d1.setDate(d1.getDate()+1);

    const customers = await Customer.find({ 'debts.dueDate': { $gte: d0, $lt: d1 } });
    const debts = [];
    for (const c of customers) {
      (c.debts || []).forEach(d => {
        const dd = new Date(d.dueDate);
        if (dd >= d0 && dd < d1) {
          debts.push({
            customerId: c._id,
            customerName: c.name,
            saleId: d.saleId,
            dueDate: d.dueDate,
            amount: d.amount,
            status: d.status
          });
        }
      });
    }
    res.json({ debts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
