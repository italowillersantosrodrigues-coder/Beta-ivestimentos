// src/routes/clients.js
import express from "express";
import Cliente from "../models/client.js";

const router = express.Router();

// =============================
// GET /api/clientes → listar todos
// =============================
router.get("/", async (req, res) => {
  try {
    const clientes = await Cliente.find().sort({ createdAt: -1 });
    return res.json(clientes);
  } catch (err) {
    console.error("Erro ao buscar clientes:", err);
    return res.status(500).json({ error: "Erro ao buscar clientes" });
  }
});

// =============================
// POST /api/clientes → criar novo
// =============================
router.post("/", async (req, res) => {
  try {
    const { nome, email, telefone, cpf, cidade, status } = req.body;

    if (!nome) {
      return res.status(400).json({ error: "O campo nome é obrigatório" });
    }

    const novo = await Cliente.create({
      nome,
      email,
      telefone,
      cpf,
      cidade,
      status: status || "Ativo",
    });

    return res.status(201).json(novo);
  } catch (err) {
    console.error("Erro ao criar cliente:", err);
    return res.status(500).json({ error: "Erro ao criar cliente" });
  }
});

// =============================
// PUT /api/clientes/:id → atualizar
// =============================
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const dados = req.body;

    const atualizado = await Cliente.findByIdAndUpdate(id, dados, {
      new: true,
    });

    if (!atualizado) return res.status(404).json({ error: "Cliente não encontrado" });
    return res.json(atualizado);
  } catch (err) {
    console.error("Erro ao atualizar cliente:", err);
    return res.status(500).json({ error: "Erro ao atualizar cliente" });
  }
});

// =============================
// DELETE /api/clientes/:id → remover
// =============================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletado = await Cliente.findByIdAndDelete(id);
    if (!deletado) return res.status(404).json({ error: "Cliente não encontrado" });
    return res.json({ message: "Cliente excluído com sucesso" });
  } catch (err) {
    console.error("Erro ao excluir cliente:", err);
    return res.status(500).json({ error: "Erro ao excluir cliente" });
  }
});

export default router;
