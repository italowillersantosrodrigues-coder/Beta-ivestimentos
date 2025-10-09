// src/routes/clients.js
import express from 'express';
import Client from '../models/client.js';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const c = new Client(req.body);
    await c.save();
    res.status(201).json(c);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const clients = await Client.find().sort({createdAt:-1});
  res.json(clients);
});

router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(client);
  } catch(e){
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updated = await Client.findByIdAndUpdate(req.params.id, req.body, {new:true});
    res.json(updated);
  } catch(e){
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Client.findByIdAndDelete(req.params.id);
    res.json({ ok:true });
  } catch(e){ res.status(400).json({ error: e.message }); }
});

export default router;
