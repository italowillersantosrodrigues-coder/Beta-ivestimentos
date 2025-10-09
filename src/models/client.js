import mongoose from "mongoose";

const clienteSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    telefone: { type: String, trim: true },
    cpf: { type: String, trim: true },
    cidade: { type: String, trim: true },
    status: { type: String, default: "Ativo" },
  },
  { timestamps: true }
);

export default mongoose.models.Cliente || mongoose.model("Cliente", clienteSchema);
