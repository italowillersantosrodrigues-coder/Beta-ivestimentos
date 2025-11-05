// src/routes/agenda.js
import express from 'express';
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';

const router = express.Router();

// GET /api/agenda?date=YYYY-MM-DD -> lista eventos (se date não informado, retorna 30 dias)
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    const db = mongoose.connection.db;
    const coll = db.collection('agenda');

    if (date) {
      // busca por dia específico
      const start = new Date(date);
      start.setHours(0,0,0,0);
      const end = new Date(date);
      end.setHours(23,59,59,999);
      const rows = await coll.find({ data: { $gte: start, $lte: end } }).sort({ data: 1 }).toArray();
      return res.json(rows);
    } else {
      // últimos 90 dias por padrão (limitar)
      const start = new Date(); start.setDate(start.getDate() - 90);
      const rows = await coll.find({ data: { $gte: start } }).sort({ data: 1 }).limit(1000).toArray();
      return res.json(rows);
    }
  } catch (err) {
    console.error('agenda get error', err);
    res.status(500).json({ error: 'erro interno' });
  }
});

// GET /api/agenda/:id
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const db = mongoose.connection.db;
    const coll = db.collection('agenda');
    const row = await coll.findOne({ _id: new ObjectId(id) });
    if (!row) return res.status(404).json({ error: 'não encontrado' });
    res.json(row);
  } catch (err) {
    console.error('agenda get by id error', err);
    res.status(500).json({ error: 'erro interno' });
  }
});

// POST /api/agenda
router.post('/', async (req, res) => {
  try {
    const { date, time, client, tech, desc, value = 0, status = 'pending' } = req.body;
    if (!date) return res.status(400).json({ error: 'data é obrigatória' });
    const db = mongoose.connection.db;
    const coll = db.collection('agenda');

    const dataDate = new Date(date);
    // store document shape:
    const doc = { data: dataDate, time, client, tech, desc, value: Number(value || 0), status, criado_em: new Date() };
    const r = await coll.insertOne(doc);
    const newDoc = await coll.findOne({ _id: r.insertedId });

    // emit socket if available
    try { const io = req.app.get('io'); if (io) io.emit('agenda:new', newDoc); } catch(e){}

    res.status(201).json(newDoc);
  } catch (err) {
    console.error('agenda post error', err);
    res.status(500).json({ error: 'erro interno' });
  }
});

// PUT /api/agenda/:id
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { date, time, client, tech, desc, value, status } = req.body;
    const db = mongoose.connection.db;
    const coll = db.collection('agenda');
    const update = {};
    if (date) update.data = new Date(date);
    if (time !== undefined) update.time = time;
    if (client !== undefined) update.client = client;
    if (tech !== undefined) update.tech = tech;
    if (desc !== undefined) update.desc = desc;
    if (value !== undefined) update.value = Number(value || 0);
    if (status !== undefined) update.status = status;
    update.updated_at = new Date();

    const r = await coll.findOneAndUpdate({ _id: new ObjectId(id) }, { $set: update }, { returnDocument: 'after' });
    if (!r.value) return res.status(404).json({ error: 'não encontrado' });

    try { const io = req.app.get('io'); if (io) io.emit('agenda:update', r.value); } catch(e){}

    res.json(r.value);
  } catch (err) {
    console.error('agenda put error', err);
    res.status(500).json({ error: 'erro interno' });
  }
});

// DELETE /api/agenda/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const db = mongoose.connection.db;
    const coll = db.collection('agenda');
    const r = await coll.deleteOne({ _id: new ObjectId(id) });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'não encontrado' });

    try { const io = req.app.get('io'); if (io) io.emit('agenda:delete', { _id: id }); } catch(e){}

    res.json({ ok: true });
  } catch (err) {
    console.error('agenda delete error', err);
    res.status(500).json({ error: 'erro interno' });
  }
});

export default router;
