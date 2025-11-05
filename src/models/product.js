import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true,
    },
    descricao: {
      type: String,
      required: false,
    },
    precoCusto: {
      type: Number,
      default: 0, // preço que você paga no produto
    },
    precoVenda: {
      type: Number,
      default: 0, // preço que você vende
    },
    preco: {
      type: Number,
      default: 0, // campo legado usado antes — mantém compatibilidade
    },
    desconto: {
      type: Number,
      default: 0,
    },
    estoque: {
      type: Number,
      default: 0,
    },
    foto: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
    collection: "produtos", // mantém a mesma coleção
  }
);

// Garante que o model não seja recriado
export default mongoose.models.Produto || mongoose.model("Produto", productSchema);
