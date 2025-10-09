// src/models/Product.js
import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
  nome: String,
  descricao: String,
  preco: Number,
  estoque: Number,
  criadoEm: { type: Date, default: Date.now },
  // adicione campos extras
});

export default mongoose.models.Product || mongoose.model("Product", ProductSchema);
