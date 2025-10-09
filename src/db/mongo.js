// src/db/mongo.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config(); // 🔹 Deve estar no topo para carregar variáveis

// Lê a URI do .env
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error(
    "ERRO: MONGO_URI não definida no .env (MONGO_URI ou MONGODB_URI)."
  );
  process.exit(1);
}

// Variável global para hot-reload / serverless
let cached = global._mongoClientPromise;

if (!cached) {
  cached = mongoose
    .connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then((mongooseInstance) => {
      console.log("MongoDB conectado com sucesso.");
      return mongooseInstance;
    })
    .catch((err) => {
      console.error("Erro conectando ao MongoDB:", err);
      throw err;
    });

  global._mongoClientPromise = cached;
}

export default mongoose;
