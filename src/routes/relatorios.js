// src/routes/relatorios.js
import express from "express";
import Venda from "../models/Venda.js";
import mongoose from "mongoose";

const router = express.Router();

// GET /api/relatorios/list?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=50
router.get("/list", async (req, res) => {
  try {
    const { from, to, page = 1, limit = 50 } = req.query;
    const q = {};
    if (from || to) {
      q.createdAt = {};
      if (from) q.createdAt.$gte = new Date(from + "T00:00:00");
      if (to) q.createdAt.$lte = new Date(to + "T23:59:59");
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    // buscamos vendas e populamos cliente; para produtos usaremos lookup below
    const vendas = await Venda.find(q)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate({ path: "cliente_id", select: "nome name email" }) // ajustar campo do cliente
      .lean();

    // enrich: se houver items com produto_id, buscar nome do produto
    // monta um cache local de produto ids para evitar várias queries
    const prodIds = new Set();
    vendas.forEach(v => {
      if (Array.isArray(v.items)) v.items.forEach(it => { if (it.produto_id) prodIds.add(String(it.produto_id)); });
    });

    let prodMap = {};
    if (prodIds.size) {
      const Produto = mongoose.connection.collection("produtos");
      const ids = Array.from(prodIds).map(id => new mongoose.Types.ObjectId(id));
      const prods = await Produto.find({ _id: { $in: ids } }).toArray();
      prods.forEach(p => { prodMap[String(p._id)] = p; });
    }

    // anexa nome do produto em cada item quando possível
    vendas.forEach(v => {
      if (Array.isArray(v.items)) {
        v.items = v.items.map(it => {
          if (it.produto_id && prodMap[String(it.produto_id)]) {
            return Object.assign({}, it, { productName: prodMap[String(it.produto_id)].nome || prodMap[String(it.produto_id)].name });
          }
          return it;
        });
      } else {
        v.items = v.items || [];
      }
    });

    return res.json({ ok: true, vendas, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error("GET /api/relatorios/list error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Erro interno" });
  }
});

// PATCH /api/relatorios/update?id=...
// body: { override: { cost: Number, profit: Number } }
router.patch("/update", async (req, res) => {
  try {
    const id = req.query.id || req.body.id;
    if (!id) return res.status(400).json({ ok: false, error: "id obrigatório" });
    const override = req.body.override || null;
    // valida formato básico
    const doc = {};
    if (override === null) doc.override = null;
    else if (typeof override === "object") {
      doc.override = {
        cost: Number(override.cost || 0),
        profit: Number(override.profit || 0)
      };
    } else {
      return res.status(400).json({ ok: false, error: "override inválido" });
    }

    const venda = await Venda.findByIdAndUpdate(id, { $set: doc }, { new: true }).lean();
    if (!venda) return res.status(404).json({ ok: false, error: "Venda não encontrada" });

    return res.json({ ok: true, venda });
  } catch (err) {
    console.error("PATCH /api/relatorios/update error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Erro interno" });
  }
});

// fallback compatível com /api/sales/:id/override que o frontend também tenta
router.post("/sales/:id/override", async (req, res) => {
  try {
    const id = req.params.id;
    const { cost, profit } = req.body;
    const override = { cost: Number(cost || 0), profit: Number(profit || 0) };
    const venda = await Venda.findByIdAndUpdate(id, { $set: { override } }, { new: true }).lean();
    if (!venda) return res.status(404).json({ ok: false, error: "Venda não encontrada" });
    return res.json({ ok: true, venda });
  } catch (err) {
    console.error("POST /api/sales/:id/override error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Erro interno" });
  }
});

export default router;
