import express from "express";
import Venda from "../models/Venda.js";
import Cliente from "../models/Cliente.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { from, to } = req.query;
    const inicio = from ? new Date(from) : new Date("1970-01-01");
    const fim = to ? new Date(to) : new Date("2999-12-31");

    const vendas = await Venda.find({
      criado_em: { $gte: inicio, $lte: fim },
    }).populate("cliente_id");

    const total_vendas = vendas.length;
    const receita = vendas.reduce((s, v) => s + v.total, 0);

    res.json({
      total_vendas,
      receita,
      vendas: vendas.map(v => ({
        id: v._id,
        cliente: v.cliente_id?.nome,
        total: v.total,
        tipo: v.tipo_pagamento,
        status: v.status,
        criado_em: v.criado_em,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
