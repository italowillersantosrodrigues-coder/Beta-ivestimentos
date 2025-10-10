// src/routes/vendas.js
import express from "express";
import mongoose from "mongoose";
import Venda from "../models/Venda.js";
import { agendarCobranca } from "../utils/agenda.js"; // opcional

const router = express.Router();

function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function isCarne(tipo) {
  if (!tipo) return false;
  const t = String(tipo).toLowerCase();
  return t.includes("carne") || t.includes("carnê");
}

function gerarParcelas(total, parcelasCount, primeiraDataStr) {
  const base = Math.floor((total / parcelasCount) * 100) / 100;
  const somaBase = base * parcelasCount;
  const diff = Math.round((total - somaBase) * 100) / 100;
  const valores = Array(parcelasCount).fill(base);
  if (diff !== 0)
    valores[parcelasCount - 1] = Math.round((valores[parcelasCount - 1] + diff) * 100) / 100;

  const primeira = primeiraDataStr ? new Date(primeiraDataStr) : new Date();
  return valores.map((v, i) => ({
    numero: i + 1,
    valor: v,
    vencimento: addMonths(primeira, i),
    status: "pendente"
  }));
}

router.post("/", async (req, res) => {
  const session = await mongoose.startSession();
  await session.startTransaction();

  try {
    const body = req.body || {};
    const clienteId = body.cliente_id || body.client || body.clientId || null;

    // calcula total (aceita items[] ou total bruto)
    let total = 0;
    if (Array.isArray(body.items) && body.items.length) {
      total = body.items.reduce((s, it) => {
        const price = Number(it.unitPrice || it.unit_price || it.price || 0);
        const qty = Number(it.quantity || it.qtd || it.qty || 1);
        return s + price * qty;
      }, 0);
      total = Math.round(total * 100) / 100;
    } else if (typeof body.total === "number") {
      total = body.total;
    } else if (typeof body.total === "string") {
      const p = Number(body.total.replace(/[^\d.-]/g, "").replace(",", "."));
      total = isNaN(p) ? 0 : p;
    }

    if (!total || total <= 0) throw new Error("Total inválido");

    // normaliza tipo de pagamento
    let tipo = (body.tipo_pagamento || body.paymentType || body.payment_type || "").toString().toLowerCase();
    if (["avista", "pix", "dinheiro"].includes(tipo)) tipo = "à vista";
    else if (tipo.includes("parcel")) tipo = "parcelado";
    else if (tipo.includes("carne")) tipo = "carne";
    else if (!tipo) tipo = "à vista";

    const parcelasCount = Number(body.parcelas || body.installments || body.installmentsCount || 0);
    const primeiraVenc = body.primeira_vencimento || body.firstDueDate || body.primeiroVencimento || body.first_due_date || null;

    const vendaDoc = {
      cliente_id: clienteId,
      total,
      tipo_pagamento: tipo,
      parcelas: [],
      status: body.status || "aberta",
      observacao: body.observacao || body.notes || ""
    };

    // gera parcelas se for parcelado/carnê
    if (tipo === "parcelado" || tipo === "carne") {
      if (!parcelasCount || parcelasCount <= 0) throw new Error("Quantidade de parcelas inválida");
      if (!primeiraVenc) throw new Error("primeira_vencimento é obrigatório para parcelado");
      vendaDoc.parcelas = gerarParcelas(total, parcelasCount, primeiraVenc);
    }

    const [venda] = await Venda.create([vendaDoc], { session });

    // o watcher cuidará de gerar as agendas automaticamente
    // (nenhum create de Agenda aqui)

    // chama util de agendamento se existir (opcional)
    if ((tipo === "parcelado" || tipo === "carne") && venda.parcelas && venda.parcelas.length) {
      for (const p of venda.parcelas) {
        try {
          if (typeof agendarCobranca === "function") {
            await agendarCobranca(venda._id, p.numero, p.vencimento);
          }
        } catch (errAg) {
          console.error("Erro em agendarCobranca:", errAg);
        }
      }
    }

    await session.commitTransaction();
    session.endSession();

    const vendaFinal = await Venda.findById(venda._id).lean();

    // emitir socket opcional (só a venda, sem agenda)
    try {
      const io = req.app && req.app.get && req.app.get("io");
      if (io) io.emit("venda:new", { venda: vendaFinal });
    } catch (e) {
      console.error("socket emit error", e);
    }

    return res.status(201).json({ ok: true, venda: vendaFinal });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("POST /api/vendas error:", err);
    return res.status(500).json({ error: err.message || "Erro interno" });
  }
});

export default router;
