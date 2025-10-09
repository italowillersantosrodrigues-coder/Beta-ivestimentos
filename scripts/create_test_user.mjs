// scripts/create_test_user.mjs
import "./src/db/mongo.js";
import User from "./src/models/User.js";
import bcrypt from "bcryptjs";

async function run() {
  const email = "teste@local";
  const nome = "Usuário Teste";
  const senha = "Senha123!";
  const senhaHash = await bcrypt.hash(senha, 10);

  const existente = await User.findOne({ email });
  if (existente) {
    existente.senhaHash = senhaHash;
    await existente.save();
    console.log("Atualizado usuário existente:", email);
  } else {
    await User.create({ nome, email, senhaHash });
    console.log("Criado usuário teste:", email);
  }
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
