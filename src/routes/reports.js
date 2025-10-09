// src/routes/reports.js
import express from 'express';
import Sale from '../models/Sale.js';
const router = express.Router();

function startOfDay(d){ const t = new Date(d); t.setHours(0,0,0,0); return t; }
function endOfDay(d){ const t = new Date(d); t.setHours(23,59,59,999); return t; }

router.get('/daily', async (req,res)=>{
  const date = req.query.date ? new Date(req.query.date) : new Date();
  const sales = await Sale.find({ createdAt: { $gte: startOfDay(date), $lte: endOfDay(date) } });
  const total = sales.reduce((s,v)=>s+ (v.totalAmount||0), 0);
  res.json({ date: date.toISOString().split('T')[0], total, count: sales.length, sales });
});

router.get('/weekly', async (req,res)=>{
  const now = req.query.date ? new Date(req.query.date) : new Date();
  const start = new Date(now); start.setDate(now.getDate() - 7);
  const sales = await Sale.find({ createdAt: { $gte: start, $lte: now } });
  const total = sales.reduce((s,v)=>s+ (v.totalAmount||0), 0);
  res.json({ from: start, to: now, total, count: sales.length });
});

router.get('/monthly', async (req,res)=>{
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || (new Date().getMonth()+1);
  const start = new Date(year, month-1, 1);
  const end = new Date(year, month, 0); end.setHours(23,59,59,999);
  const sales = await Sale.find({ createdAt: { $gte: start, $lte: end } });
  const total = sales.reduce((s,v)=>s+ (v.totalAmount||0), 0);
  res.json({ month, year, total, count: sales.length });
});

export default router;
