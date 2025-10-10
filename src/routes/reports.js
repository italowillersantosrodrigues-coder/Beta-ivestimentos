// routes/reports.js
import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

function parseDateInput(s, endOfDay = false) {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d)) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

// === /api/relatorios/summary ===
router.get('/summary', async (req, res) => {
  try {
    const from = parseDateInput(req.query.from) || new Date(Date.now() - 1000 * 60 * 60 * 24 * 29);
    const to = parseDateInput(req.query.to, true) || new Date();
    const gran = req.query.granularity || 'month';
    const unit = gran === 'month' ? 'month' : gran === 'week' ? 'week' : 'day';
    const coll = mongoose.connection.collection('sales');

    const pipeline = [
      { $match: { criado_em: { $gte: from, $lte: to }, status: { $ne: 'cancelado' } } },
      { $addFields: { periodo: { $dateTrunc: { date: '$criado_em', unit, timezone: 'America/Sao_Paulo' } } } },
      { $group: { _id: '$periodo', total_vendas: { $sum: 1 }, receita: { $sum: { $ifNull: ['$total', 0] } } } },
      { $sort: { _id: 1 } },
    ];

    const byPeriod = await coll.aggregate(pipeline).toArray();

    const totals = await coll.aggregate([
      { $match: { criado_em: { $gte: from, $lte: to }, status: { $ne: 'cancelado' } } },
      { $group: { _id: null, total_vendas: { $sum: 1 }, receita: { $sum: { $ifNull: ['$total', 0] } } } },
    ]).toArray();

    const total = totals[0] || { total_vendas: 0, receita: 0 };
    const best = byPeriod.length ? byPeriod.reduce((a, b) => (b.receita > a.receita ? b : a)) : null;

    res.json({
      total_vendas: total.total_vendas,
      receita: total.receita,
      byPeriod: byPeriod.map(r => ({
        periodo: r._id,
        total_vendas: r.total_vendas,
        receita: r.receita,
      })),
      bestPeriodLabel: best ? new Date(best._id).toLocaleString('pt-BR') : '—',
    });
  } catch (err) {
    console.error('GET /api/relatorios/summary error', err);
    res.status(500).json({ error: 'Erro ao gerar resumo' });
  }
});

// === /api/relatorios/by-product ===
router.get('/by-product', async (req, res) => {
  try {
    const from = parseDateInput(req.query.from) || new Date(Date.now() - 1000 * 60 * 60 * 24 * 29);
    const to = parseDateInput(req.query.to, true) || new Date();
    const top = parseInt(req.query.top, 10) || 10;

    const coll = mongoose.connection.collection('sales');

    const pipeline = [
      { $match: { criado_em: { $gte: from, $lte: to }, status: { $ne: 'cancelado' } } },
      { $unwind: '$produtos' },
      {
        $group: {
          _id: '$produtos.nome',
          unidades: { $sum: { $ifNull: ['$produtos.quantidade', 0] } },
          receita: { $sum: { $ifNull: ['$produtos.total', 0] } },
        },
      },
      { $sort: { receita: -1 } },
      { $limit: top },
    ];

    const rows = await coll.aggregate(pipeline).toArray();
    res.json({ rows });
  } catch (err) {
    console.error('GET /api/relatorios/by-product error', err);
    res.status(500).json({ error: 'Erro ao gerar por produto' });
  }
});

// === /api/relatorios/by-client ===
router.get('/by-client', async (req, res) => {
  try {
    const from = parseDateInput(req.query.from) || new Date(Date.now() - 1000 * 60 * 60 * 24 * 29);
    const to = parseDateInput(req.query.to, true) || new Date();
    const top = parseInt(req.query.top, 10) || 10;

    const coll = mongoose.connection.collection('sales');

    const pipeline = [
      { $match: { criado_em: { $gte: from, $lte: to }, status: { $ne: 'cancelado' } } },
      {
        $group: {
          _id: '$cliente',
          total_vendas: { $sum: 1 },
          receita: { $sum: { $ifNull: ['$total', 0] } },
        },
      },
      { $sort: { receita: -1 } },
      { $limit: top },
    ];

    const rows = await coll.aggregate(pipeline).toArray();
    res.json({ rows });
  } catch (err) {
    console.error('GET /api/relatorios/by-client error', err);
    res.status(500).json({ error: 'Erro ao gerar por cliente' });
  }
});

// === /api/relatorios/list ===
router.get('/list', async (req, res) => {
  try {
    const from = parseDateInput(req.query.from) || new Date(Date.now() - 1000 * 60 * 60 * 24 * 29);
    const to = parseDateInput(req.query.to, true) || new Date();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(1000, parseInt(req.query.limit, 10) || 50);

    const coll = mongoose.connection.collection('sales');

    const filter = { criado_em: { $gte: from, $lte: to } };

    const total = await coll.countDocuments(filter);
    const vendas = await coll.find(filter).sort({ criado_em: -1 }).skip((page - 1) * limit).limit(limit).toArray();

    res.json({ total, page, limit, vendas });
  } catch (err) {
    console.error('GET /api/relatorios/list error', err);
    res.status(500).json({ error: 'Erro ao listar vendas' });
  }
});

export default router;
