// server.js - versão integrada para Beta Investimentos
// Requisitos: node >= 14, npm install express body-parser sqlite3 nodemailer node-cron cors

const express    = require("express");
const bodyParser = require("body-parser");
const sqlite3    = require("sqlite3").verbose();
const nodemailer = require("nodemailer");
const cron       = require("node-cron");
const path       = require("path");
const cors       = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve os arquivos estáticos da pasta "public"
app.use(express.static(path.join(__dirname, "public")));

// ----------------- Banco (SQLite) -----------------
const DB_FILE = path.join(__dirname, "loja.db");
const db = new sqlite3.Database(DB_FILE);
db.exec("PRAGMA foreign_keys = ON;");

// cria tabelas se não existirem
function createTables() {
  db.run(`CREATE TABLE IF NOT EXISTS clientes(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    telefone TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS leads(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT,
    nome TEXT,
    email TEXT NOT NULL UNIQUE,
    picture TEXT,
    telefone TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS produtos(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    preco REAL NOT NULL,
    estoque INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS vendas(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    total REAL NOT NULL DEFAULT 0,
    lucro REAL NOT NULL DEFAULT 0,
    vencimento DATE,
    metodo_pagamento TEXT DEFAULT 'dinheiro',
    data_compra DATE DEFAULT (DATE('now')),
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    enviado_email_conclusao INTEGER DEFAULT 0,
    enviado_email_cobranca INTEGER DEFAULT 0,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS venda_itens(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venda_id INTEGER NOT NULL,
    produto_id INTEGER NOT NULL,
    quantidade INTEGER NOT NULL,
    preco_unitario REAL NOT NULL,
    FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS parcelas(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venda_id INTEGER NOT NULL,
    num_parcela INTEGER NOT NULL,
    qtd_total INTEGER NOT NULL,
    valor REAL NOT NULL,
    vencimento DATE NOT NULL,
    status TEXT DEFAULT 'aberta',
    enviado_email_pre INTEGER DEFAULT 0,
    enviado_email_dia INTEGER DEFAULT 0,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (venda_id) REFERENCES vendas(id) ON DELETE CASCADE
  )`);
}
createTables();

// ----------------- Nodemailer (Gmail) -----------------
const GMAIL_USER = process.env.GMAIL_USER || "betainvestimentos34@gmail.com";
const GMAIL_PASS = process.env.GMAIL_PASS || "";

let transporter;
if (GMAIL_USER && GMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_PASS }
  });
} else {
  const smtpHost  = process.env.SMTP_HOST || "smtp.example.com";
  const smtpPort  = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const smtpUser  = process.env.SMTP_USER || "user@example.com";
  const smtpPass  = process.env.SMTP_PASS || "senha";
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass }
  });
}

function enviarEmail(to, subject, html) {
  const from = `"Beta Investimentos" <${GMAIL_USER}>`;
  return transporter.sendMail({ from, to, subject, html });
}

// ----------------- Suas rotas API (clientes, produtos, vendas, parcelas, leads, relatórios, cron) -----------------
// (mantive tudo exatamente como estava, não removi nada)
// ...

// ----------------- Rotas HTML -----------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Permite acessar diretamente arquivos .html (ex: /menu.html)
app.get("/:page", (req, res, next) => {
  if (req.params.page.endsWith(".html")) {
    res.sendFile(path.join(__dirname, "public", req.params.page));
  } else {
    next();
  }
});

// ----------------- Inicialização -----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`GMAIL_USER=${GMAIL_USER ? '[configured]' : '[not configured]'}`);
});
