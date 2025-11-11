// src/routes/reports.js
import express from 'express';
const router = express.Router();

// Usamos mongoose.connection diretamente (só leitura) para evitar dependência estrita de modelos
import mongoose from 'mongoose';

function parseRange(from, to) {
  const f = from ? new Date(from) : null;
  const t = to ? new Date(to) : null;
  if (t) t.setHours(23,59,59,999);
  return { f, t };
}

// GET /api/relatorios/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|week|month
router.get('/summary', async (req, res) => {
  try {
    const { from, to, granularity = 'month' } = req.query;
    const { f, t } = parseRange(from, to);
    const match = {};
    if (f) match.criado_em = { $gte: f };
    if (t) match.criado_em = Object.assign(match.criado_em || {}, { $lte: t });

    const db = mongoose.connection.db;
    const coll = db.collection('vendas');

    // total vendas e receita
    const totals = await coll.aggregate([
      { $match: match },
      { $group: { _id: null, total_vendas: { $sum: 1 }, receita: { $sum: { $ifNull: ["$total", 0] } } } }
    ]).toArray();

    const total_vendas = totals[0]?.total_vendas || 0;
    const receita = totals[0]?.receita || 0;

    // aggregate per period
    let groupId;
    if (granularity === 'day') {
      groupId = { year: { $year: "$criado_em" }, month: { $month: "$criado_em" }, day: { $dayOfMonth: "$criado_em" } };
    } else if (granularity === 'week') {
      groupId = { year: { $isoWeekYear: "$criado_em" }, week: { $isoWeek: "$criado_em" } };
    } else {
      groupId = { year: { $year: "$criado_em" }, month: { $month: "$criado_em" } };
    }

    const byPeriodRaw = await coll.aggregate([
      { $match: match },
      { $group: { _id: groupId, receita: { $sum: { $ifNull: ["$total", 0] } }, count: { $sum: 1 } } },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.week": 1, "_id.day": 1 } }
    ]).toArray();

    const byPeriod = byPeriodRaw.map(r => {
      let periodo;
      if (granularity === 'day') periodo = new Date(r._id.year, r._id.month - 1, r._id.day).toISOString();
      else if (granularity === 'week') {
        const year = r._id.year, week = r._id.week;
        const simple = new Date(year, 0, 1 + (week - 1) * 7);
        periodo = simple.toISOString();
      } else periodo = new Date(r._id.year, r._id.month - 1, 1).toISOString();
      return { periodo, receita: r.receita, count: r.count };
    });

    // best period label
    const bestRow = byPeriod.reduce((a,b) => (b.receita > (a?.receita||0) ? b : a), null);
    const bestPeriodLabel = bestRow ? new Date(bestRow.periodo).toLocaleDateString('pt-BR') : null;

    res.json({ total_vendas, receita, byPeriod, bestPeriodLabel });
  } catch (err) {
    console.error('reports summary error', err);
    res.status(500).json({ error: 'erro interno' });
  }
});

// GET /api/relatorios/by-product?from=...&to=...&top=10
router.get('/by-product', async (req, res) => {
  try {
    const { from, to, top = 10 } = req.query;
    const { f, t } = parseRange(from, to);
    const match = {};
    if (f) match.criado_em = { $gte: f };
    if (t) match.criado_em = Object.assign(match.criado_em || {}, { $lte: t });

    const db = mongoose.connection.db;
    const coll = db.collection('vendas');

    // espera campo "itens" em cada venda (se tiver outro nome, adaptar)
    const rows = await coll.aggregate([
      { $match: match },
      { $unwind: "$itens" },
      { $group: { _id: "$itens.produto", receita: { $sum: "$itens.total" }, quantidade: { $sum: "$itens.quantidade" } } },
      { $sort: { receita: -1 } },
      { $limit: Number(top) }
    ]).toArray();

    res.json({ rows });
  } catch (err) {
    console.error('reports by-product error', err);
    res.status(500).json({ error: 'erro interno' });
  }
});

// GET /api/relatorios/by-client?from=...&to=...&top=10
router.get('/by-client', async (req, res) => {
  try {
    const { from, to, top = 10 } = req.query;
    const { f, t } = parseRange(from, to);
    const match = {};
    if (f) match.criado_em = { $gte: f };
    if (t) match.criado_em = Object.assign(match.criado_em || {}, { $lte: t });

    const db = mongoose.connection.db;
    const coll = db.collection('vendas');

    const rows = await coll.aggregate([
      { $match: match },
      { $group: { _id: "$cliente", receita: { $sum: { $ifNull: ["$total", 0] } }, count: { $sum: 1 } } },
      { $sort: { receita: -1 } },
      { $limit: Number(top) }
    ]).toArray();

    res.json({ rows });
  } catch (err) {
    console.error('reports by-client error', err);
    res.status(500).json({ error: 'erro interno' });
  }
});

// GET /api/relatorios/list?from=...&to=...&page=1&limit=50
router.get('/list', async (req, res) => {
  try {
    const { from, to, page = 1, limit = 50 } = req.query;
    const { f, t } = parseRange(from, to);
    const match = {};
    if (f) match.criado_em = { $gte: f };
    if (t) match.criado_em = Object.assign(match.criado_em || {}, { $lte: t });

    const db = mongoose.connection.db;
    const coll = db.collection('vendas');

    const pageNum = Math.max(1, parseInt(page));
    const lim = Math.max(1, Math.min(1000, parseInt(limit)));

    const cursor = coll.find(match).sort({ criado_em: -1 }).skip((pageNum-1)*lim).limit(lim);
    const vendas = await cursor.toArray();

    res.json({ page: pageNum, limit: lim, vendas });
  } catch (err) {
    console.error('reports list error', err);
    res.status(500).json({ error: 'erro interno' });
  }
});

export default router;

