import express from "express";
import Venda from "../models/Venda.js";
import Cliente from "../models/Cliente.js";
import { agendarCobranca } from "../utils/agenda.js";

const router = express.Router();

function gerarParcelas(total, parcelas, primeiraDataStr) {
  const valorBase = Math.round((total / parcelas) * 100) / 100;
  const primeiraData = new Date(primeiraDataStr);
  return Array.from({ length: parcelas }, (_, i) => {
    const due = new Date(primeiraData);
    due.setMonth(due.getMonth() + i);
    return { numero: i + 1, valor: valorBase, vencimento: due };
  });
}

// POST /api/vendas
router.post("/", async (req, res) => {
  try {
    const { cliente_id, total, tipo_pagamento, parcelas, primeira_vencimento } = req.body;

    const venda = new Venda({
      cliente_id,
      total,
      tipo_pagamento,
      parcelas:
        tipo_pagamento === "parcelado"
          ? gerarParcelas(total, parcelas, primeira_vencimento)
          : [],
    });

    await venda.save();

    // Agendar cobranças automáticas via Gmail
    if (tipo_pagamento === "parcelado") {
      for (const p of venda.parcelas) {
        await agendarCobranca(venda._id, p.numero, p.vencimento);
      }
    }

    res.json({ ok: true, venda });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
