const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./loja.db");

db.serialize(() => {
  // Clientes
  db.run(`CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Produtos / estoque
  db.run(`CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    preco REAL NOT NULL,
    estoque INTEGER NOT NULL DEFAULT 0,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Vendas
  db.run(`CREATE TABLE IF NOT EXISTS vendas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    total REAL NOT NULL,
    lucro REAL NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    vencimento DATE,
    enviado_email_conclusao INTEGER DEFAULT 0,
    enviado_email_cobranca INTEGER DEFAULT 0,
    FOREIGN KEY(cliente_id) REFERENCES clientes(id)
  )`);

  // Itens de venda
  db.run(`CREATE TABLE IF NOT EXISTS venda_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venda_id INTEGER,
    produto_id INTEGER,
    quantidade INTEGER,
    preco_unitario REAL,
    FOREIGN KEY(venda_id) REFERENCES vendas(id),
    FOREIGN KEY(produto_id) REFERENCES produtos(id)
  )`);

  console.log("Tabelas criadas/confirmadas com sucesso.");
});

db.close();
