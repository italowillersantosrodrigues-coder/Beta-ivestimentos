// scripts/migrate-sqlite-to-mongo.js
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const mongoose = require('mongoose');
const User = require('../src/models/User'); // ajustar caminho

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Mongo conectado');

  const db = new sqlite3.Database('./loja.db', sqlite3.OPEN_READONLY);

  db.all("SELECT * FROM users", async (err, rows) => {
    if (err) {
      console.error('Erro lendo sqlite', err);
      process.exit(1);
    }
    for (const row of rows) {
      // ajuste os nomes das colunas conforme seu schema SQLite
      const email = row.email;
      const password = row.password; // se já for hash, mantém
      const name = row.name || row.usuario || row.nome;

      try {
        // evita duplicados
        const exists = await User.findOne({ email });
        if (exists) {
          console.log('Pulando (já existe):', email);
          continue;
        }
        await User.create({ name, email, password });
        console.log('Importado:', email);
      } catch (e) {
        console.error('Erro importando', email, e.message);
      }
    }
    db.close();
    console.log('Migração finalizada');
    process.exit(0);
  });
}

run();
