// init-db.js (versão para Mongo)
import mongoose from "mongoose";
import "./src/db/mongo.js"; // já faz connect
import User from "./src/models/User.js";
import Product from "./src/models/Product.js";

async function seed() {
  try {
    // OPTIONAL: limpa coleções só se quiser reset
    // await User.deleteMany({});
    // await Product.deleteMany({});

    // Exemplo de seed: (adicione os dados reais que quiser)
    const existing = await User.findOne({ email: "admin@example.com" });
    if (!existing) {
      await User.create({
        nome: "Admin",
        email: "admin@example.com",
        senhaHash: "$2a$10$examplehashreplace", // se quiser deixar senha de seed, gere hash real
        papel: "admin",
      });
      console.log("Usuário admin criado.");
    } else {
      console.log("Usuário admin já existe.");
    }

    // product seed
    const p = await Product.findOne({ nome: "Produto Exemplo" });
    if (!p) {
      await Product.create({
        nome: "Produto Exemplo",
        descricao: "Seed inicial",
        preco: 10.0,
        estoque: 100,
      });
      console.log("Produto seed criado.");
    } else {
      console.log("Produto já existe.");
    }

    console.log("Seed concluído.");
    process.exit(0);
  } catch (err) {
    console.error("Erro no seed:", err);
    process.exit(1);
  }
}

seed();
