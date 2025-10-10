import mongoose from "mongoose";

const parcelaSchema = new mongoose.Schema({
  numero: Number,
  valor: Number,
  vencimento: Date,
  status: { type: String, default: "pendente" },
  enviado_email: { type: Boolean, default: false },
});

const vendaSchema = new mongoose.Schema({
  cliente_id: { type: mongoose.Schema.Types.ObjectId, ref: "Cliente" },
  total: { type: Number, required: true },
  tipo_pagamento: { type: String, enum: ["à vista", "parcelado"], required: true },
  parcelas: [parcelaSchema],
  status: { type: String, default: "aberta" },
  criado_em: { type: Date, default: Date.now },
});

export default mongoose.model("Venda", vendaSchema);
