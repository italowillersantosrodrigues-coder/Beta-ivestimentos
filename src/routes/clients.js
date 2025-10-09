// src/routes/clients.js
import express from 'express';
import mongoose from 'mongoose';
import Cliente from '../models/client.js'; // <-- use este caminho e nome exatamente

const router = express.Router();

// GET /api/clients  -> listar todos (com paginação simples opcional)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, q } = req.query;
    const filter = q
      ? { $or: [
          { nome: new RegExp(q, 'i') },
          { email: new RegExp(q, 'i') },
          { telefone: new RegExp(q, 'i') }
        ] }
      : {};
    const clients = await Cliente.find(filter)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });
    const total = await Cliente.countDocuments(filter);
    res.json({ data: clients, page: Number(page), limit: Number(limit), total });
  } catch (err) {
    console.error('GET /api/clients error:', err);
    res.status(500).json({ error: 'Erro ao listar clientes' });
  }
});

// GET /api/clients/:id -> obter 1 cliente
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido' });

    const client = await Cliente.findById(id);
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

    res.json(client);
  } catch (err) {
    console.error('GET /api/clients/:id error:', err);
    res.status(500).json({ error: 'Erro ao buscar cliente' });
  }
});

// POST /api/clients -> criar
router.post('/', async (req, res) => {
  try {
    const { nome, email, telefone, cpfCnpj, endereco, notas } = req.body;
    if (!nome || !email) return res.status(400).json({ error: 'nome e email são obrigatórios' });

    const novo = new Cliente({ nome, email, telefone, cpfCnpj, endereco, notas });
    const saved = await novo.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('POST /api/clients error:', err);
    res.status(500).json({ error: 'Erro ao criar cliente' });
  }
});

// PUT /api/clients/:id -> atualizar
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido' });

    const updates = req.body;
    const updated = await Cliente.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: 'Cliente não encontrado' });

    res.json(updated);
  } catch (err) {
    console.error('PUT /api/clients/:id error:', err);
    res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
});

// DELETE /api/clients/:id -> excluir
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido' });

    const removed = await Cliente.findByIdAndDelete(id);
    if (!removed) return res.status(404).json({ error: 'Cliente não encontrado' });

    res.json({ message: 'Cliente removido', id: removed._id });
  } catch (err) {
    console.error('DELETE /api/clients/:id error:', err);
    res.status(500).json({ error: 'Erro ao remover cliente' });
  }
});

export default router;
