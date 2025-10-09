// src/routes/templates.js
import express from 'express';
import Template from '../models/MessageTemplate.js';
const router = express.Router();

router.get('/', async (req,res) => {
  const list = await Template.find({});
  res.json(list);
});

router.get('/:key', async (req,res) => {
  const t = await Template.findOne({ key: req.params.key });
  if (!t) return res.status(404).json({ error: 'not found' });
  res.json(t);
});

router.post('/', async (req,res) => {
  const t = new Template(req.body);
  await t.save();
  res.json(t);
});

router.put('/:id', async (req,res) => {
  const t = await Template.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(t);
});

router.delete('/:id', async (req,res) => {
  await Template.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

export default router;
