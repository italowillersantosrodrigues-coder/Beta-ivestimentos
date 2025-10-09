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
    preco: {
      type: Number,
      required: true,
      default: 0,
    },
    desconto: {
      type: Number,
      required: false,
      default: 0,
    },
    estoque: {
      type: Number,
      required: true,
      default: 0,
    },
    foto: {
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Produto", productSchema);
