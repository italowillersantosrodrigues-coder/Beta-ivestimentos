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

// item de venda (opcional, útil para mostrar produtos)
const ItemSchema = new Schema({
  produto_id: { type: Schema.Types.ObjectId, ref: "Produto", required: false },
  name: { type: String, required: false }, // redundância útil se quiser guardar nome no momento da venda
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  cost: { type: Number, default: 0 } // custo por unidade (opcional)
}, { _id: true });

const OverrideSchema = new Schema({
  cost: { type: Number, default: 0 },
  profit: { type: Number, default: 0 }
}, { _id: false });

const VendaSchema = new Schema({
  cliente_id: { type: Schema.Types.ObjectId, ref: "Cliente", required: false },
  total: { type: Number, required: true },
  tipo_pagamento: { type: String, enum: ["à vista","parcelado","carne","cartao","pix","dinheiro"], required: true },
  parcelas: { type: [ParcelaSchema], default: [] },
  items: { type: [ItemSchema], default: [] }, // opcional - útil para puxar produtos
  override: { type: OverrideSchema, default: null }, // campo para salvar custo/lucro manual
  status: { type: String, default: "aberta" },
  criado_em: { type: Date, default: Date.now },
  observacao: { type: String }
}, { timestamps: true });

// Força collection 'vendas'
export default mongoose.models.Venda || mongoose.model("Venda", VendaSchema, "vendas");
