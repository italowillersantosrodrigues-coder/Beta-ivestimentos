// src/models/Venda.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const ParcelaSchema = new Schema({
  numero: { type: Number, required: true },
  valor: { type: Number, required: true },
  vencimento: { type: Date, required: true },
  status: { type: String, default: "pendente" },
  enviado_email: { type: Boolean, default: false }
}, { _id: true });

const VendaSchema = new Schema({
  cliente_id: { type: Schema.Types.ObjectId, ref: "Cliente", required: false },
  total: { type: Number, required: true },
  tipo_pagamento: { type: String, enum: ["à vista", "parcelado", "carne", "cartao", "pix", "dinheiro"], required: true },
  parcelas: { type: [ParcelaSchema], default: [] },
  status: { type: String, default: "aberta" },
  criado_em: { type: Date, default: Date.now },
  observacao: { type: String }
}, { timestamps: true });

// Força collection 'vendas' (evita confusão com 'sales')
export default mongoose.models.Venda || mongoose.model("Venda", VendaSchema, "vendas");
