// src/models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema({
  nome: { type: String },
  email: { type: String, unique: true, required: true, index: true },
  senhaHash: { type: String },
  senha: { type: String },
  passwordHash: { type: String }, // 🔹 compatível com dados antigos
  papel: { type: String, default: "cliente" },
  criadoEm: { type: Date, default: Date.now },
});

// ✅ Atualizado: verifica todos os possíveis campos de senha
UserSchema.methods.validarSenha = async function (senhaDigitada) {
  const hash = this.senhaHash || this.passwordHash || this.senha;
  if (!hash) throw new Error("Usuário sem hash de senha");
  return await bcrypt.compare(senhaDigitada, hash);
};

export default mongoose.models.User || mongoose.model("User", UserSchema);
