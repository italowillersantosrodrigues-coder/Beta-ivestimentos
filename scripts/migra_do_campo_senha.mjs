// scripts/migra_do_campo_senha.mjs
import "./src/db/mongo.js";
import User from "./src/models/User.js";
import bcrypt from "bcryptjs";

async function migrate() {
  let count = 0;
  const cursor = User.find({ $and: [{ senha: { $exists: true } }, { $or: [{ senhaHash: { $exists: false } }, { senhaHash: null }] }] }).cursor();
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const plain = doc.senha;
    if (typeof plain === "string" && plain.length > 0) {
      const h = await bcrypt.hash(plain, 10);
      doc.senhaHash = h;
      doc.senha = undefined; // remove campo plaintext
      await doc.save();
      count++;
      console.log("Migrado:", doc.email);
    }
  }
  console.log("Migração concluída. Documentos atualizados:", count);
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });
