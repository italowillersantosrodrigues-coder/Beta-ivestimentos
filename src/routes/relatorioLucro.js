import express from "express";
import RelatorioLucro from "../models/RelatorioLucro.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { venda_id, custo, total } = req.body;
    const lucro = Number(total) - Number(custo);

    const doc = await RelatorioLucro.findOneAndUpdate(
      { venda_id },
      { custo, lucro, atualizado_em: new Date() },
      { upsert: true, new: true }
    );

    return res.json({ ok: true, relatorio: doc });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
