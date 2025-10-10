// routes/sales.js (substitua a rota POST existente por esta versão)
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

router.post("/", async (req, res) => {
  try {
    // Aceita ambos os formatos: { cliente_id, total, tipo_pagamento, ... }
    // ou { client, items: [...], paymentType, installmentsCount, firstDueDate }
    const body = req.body || {};

    // cliente
    const clienteId = body.cliente_id || body.client || body.clientId;
    if (!clienteId) return res.status(400).json({ error: "cliente_id (ou client) é obrigatório" });

    // Se veio items, calcula total a partir deles
    let total = 0;
    if (Array.isArray(body.items) && body.items.length) {
      total = body.items.reduce((s, it) => {
        const unidade = Number(it.unitPrice || it.unit_price || it.price || 0);
        const qtd = Number(it.quantity || it.qtty || 0);
        return s + (unidade * qtd);
      }, 0);
      // arredonda para 2 casas
      total = Math.round(total * 100) / 100;
    } else {
      // se veio total (como número), usa; se veio string formatada, tenta parsear
      if (typeof body.total === "number") total = body.total;
      else if (typeof body.total === "string") {
        const parsed = Number(body.total.replace(/[^\d.-]/g, "").replace(",", "."));
        total = isNaN(parsed) ? 0 : parsed;
      }
    }

    if (!total || total <= 0) {
      // permitir total zero só se você quiser; aqui vamos exigir >0
      return res.status(400).json({ error: "Total inválido ou não informado" });
    }

    // tipo de pagamento - mapear possíveis valores vindos do front
    let tipoPagamento = body.tipo_pagamento || body.paymentType || body.payment_type || "";
    tipoPagamento = String(tipoPagamento).toLowerCase();

    // mapear variantes para os valores do schema ("à vista" ou "parcelado")
    if (["avista", "pix", "dinheiro", "cartao", "cartão", "cartao_venda"].includes(tipoPagamento)) {
      tipoPagamento = "à vista";
    } else if (tipoPagamento.includes("parcel")) {
      tipoPagamento = "parcelado";
    } else {
      // fallback: se não souber, assume à vista
      tipoPagamento = tipoPagamento ? tipoPagamento : "à vista";
    }

    // Parcelas: se houve installmentsCount/parcelas e tipo parcelado, gerar
    let parcelasArr = [];
    const parcelasCount = Number(body.parcelas || body.installmentsCount || body.installments || 0);
    const primeiraVenc = body.primeira_vencimento || body.firstDueDate || body.first_due_date || body.primeiroVencimento;

    if (tipoPagamento === "parcelado") {
      if (!parcelasCount || parcelasCount <= 0) {
        return res.status(400).json({ error: "Quantidade de parcelas inválida para pagamento parcelado" });
      }
      if (!primeiraVenc) {
        return res.status(400).json({ error: "primeira_vencimento (ou firstDueDate) é obrigatório para parcelado" });
      }
      parcelasArr = gerarParcelas(total, parcelasCount, primeiraVenc);
    }

    // Monta o documento Venda conforme o schema
    const venda = new Venda({
      cliente_id: clienteId,
      total,
      tipo_pagamento: tipoPagamento,
      parcelas: parcelasArr,
      status: "aberta",
    });

    // Salva no Mongo
    await venda.save();

    // Agendar cobranças se for parcelado
    if (tipoPagamento === "parcelado" && venda.parcelas && venda.parcelas.length) {
      for (const p of venda.parcelas) {
        // agendarCobranca deve lidar com argumentos (vendaId, numeroParcela, vencimento)
        try {
          await agendarCobranca(venda._id, p.numero, p.vencimento);
        } catch (errAg) {
          console.error("Erro ao agendar cobrança parcela:", errAg);
        }
      }
    }

    // Responder com estrutura útil para o front (compatibilidade)
    return res.json({
      ok: true,
      venda,
      // campos auxiliares que seu front espera
      client: String(venda.cliente_id),
      totalAmount: venda.total,
      vendaId: String(venda._id),
    });

  } catch (err) {
    console.error("POST /api/vendas error:", err);
    return res.status(500).json({ error: err.message || "Erro interno" });
  }
});

export default router;
