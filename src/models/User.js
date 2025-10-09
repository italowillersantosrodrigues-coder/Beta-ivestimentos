// src/models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema({
  nome: { type: String, trim: true },
  email: { type: String, unique: true, required: true, index: true, trim: true, lowercase: true },
  // campo canônico que vamos usar
  senhaHash: { type: String },
  // compatibilidade com dados antigos
  senha: { type: String },
  passwordHash: { type: String },
  papel: { type: String, default: "cliente" },
  criadoEm: { type: Date, default: Date.now },
}, {
  timestamps: true
});

/**
 * Valida a senha (instância). Tenta usar os campos na ordem:
 *   senhaHash -> passwordHash -> senha
 * Lança erro se não houver hash.
 */
UserSchema.methods.validarSenha = async function (senhaDigitada) {
  const hash = this.senhaHash || this.passwordHash || this.senha;
  if (!hash) throw new Error("Usuário sem hash de senha");
  return bcrypt.compare(senhaDigitada, hash);
};

// Helper estático para extrair hash de um objeto plain (document ou plain object)
UserSchema.statics.getAnyHash = function (doc) {
  if (!doc) return null;
  return doc.senhaHash ?? doc.passwordHash ?? doc.senha ?? null;
};

const User = mongoose.models.User || mongoose.model("User", UserSchema);
export default User;
