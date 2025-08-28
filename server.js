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
app.use(express.static(path.join(__dirname, "public"))); // coloque seus HTML em ./public

// >>> Força "/" a abrir Login.html em vez de index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "Login.html"));
});

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
const GMAIL_PASS = process.env.GMAIL_PASS || ""; // **use senha de app**, NÃO sua senha normal

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

// ----------------- Rotas: CLIENTES -----------------
app.post("/api/clientes", (req, res) => {
  const { nome, email, telefone } = req.body;
  if (!nome || !email) return res.status(400).json({ error: "Nome e email são obrigatórios." });
  const sql = "INSERT INTO clientes (nome, email, telefone) VALUES (?,?,?)";
  db.run(sql, [nome, email, telefone || ""], function(err) {
    if (err) {
      if (err.message && err.message.includes("UNIQUE constraint failed")) {
        return res.status(409).json({ error: "Cliente com este email já existe." });
      }
      return res.status(500).json({ error: err.message });
    }
    return res.json({ id: this.lastID, nome, email, telefone });
  });
});

app.get("/api/clientes", (req, res) => {
  db.all("SELECT * FROM clientes ORDER BY criado_em DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    return res.json(rows);
  });
});

app.put("/api/clientes/:id", (req, res) => {
  const id = req.params.id;
  const { nome, email, telefone } = req.body;
  if (!nome || !email) return res.status(400).json({ error: "Nome e email são obrigatórios." });
  db.run("UPDATE clientes SET nome = ?, email = ?, telefone = ? WHERE id = ?", [nome, email, telefone || "", id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Cliente não encontrado." });
    return res.json({ id: Number(id), nome, email, telefone });
  });
});

app.delete("/api/clientes/:id", (req, res) => {
  db.run("DELETE FROM clientes WHERE id = ?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: "Cliente não encontrado." });
    return res.json({ success: true });
  });
});

// ----------------- Rotas: PRODUTOS -----------------
app.post("/api/produtos", (req, res) => {
  const { nome, preco, estoque } = req.body;
  if (!nome || preco == null) return res.status(400).json({ error: "Nome e preço são obrigatórios." });
  db.run("INSERT INTO produtos (nome, preco, estoque) VALUES (?,?,?)", [nome, preco, estoque || 0], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    return res.json({ id: this.lastID, nome, preco, estoque: estoque || 0 });
  });
});

app.get("/api/produtos", (req, res) => {
  db.all("SELECT * FROM produtos ORDER BY nome", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    return res.json(rows);
  });
});

app.post("/api/produtos/:id/estoque", (req, res) => {
  const { ajuste } = req.body;
  db.run("UPDATE produtos SET estoque = estoque + ? WHERE id = ?", [ajuste, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    return res.json({ success: true, changes: this.changes });
  });
});

// ----------------- Rotas: VENDAS -----------------
app.post("/api/vendas", async (req, res) => {
  try {
    const { cliente_id, itens, vencimento, metodo_pagamento, data_compra, carne } = req.body;
    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ error: "Itens da venda são obrigatórios." });
    }

    let total = 0, lucro = 0;
    itens.forEach(it => {
      total += (Number(it.preco_unitario) || 0) * (Number(it.quantidade) || 0);
      lucro += (Number(it.preco_unitario) || 0) * (Number(it.quantidade) || 0);
    });

    const dataCompraIso = data_compra ? (new Date(data_compra)).toISOString().slice(0,10) : (new Date()).toISOString().slice(0,10);

    db.run(
      "INSERT INTO vendas (cliente_id, total, lucro, vencimento, metodo_pagamento, data_compra) VALUES (?,?,?,?,?,?)",
      [cliente_id || null, total, lucro, vencimento || null, metodo_pagamento || 'dinheiro', dataCompraIso],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const vendaId = this.lastID;

        const insertItem = db.prepare("INSERT INTO venda_itens (venda_id, produto_id, quantidade, preco_unitario) VALUES (?,?,?,?)");
        for (const it of itens) {
          insertItem.run([vendaId, it.produto_id, it.quantidade, it.preco_unitario]);
          db.run("UPDATE produtos SET estoque = estoque - ? WHERE id = ?", [it.quantidade, it.produto_id]);
        }
        insertItem.finalize();

        if (metodo_pagamento === 'carne' && carne) {
          const qtd = Number(carne.qtdParcelas);
          const valorParcela = Number(carne.valorParcela);
          const primeiro = new Date(carne.primeiroVencimento);
          for (let i = 0; i < qtd; i++) {
            const venc = new Date(primeiro);
            venc.setMonth(venc.getMonth() + i);
            db.run("INSERT INTO parcelas (venda_id, num_parcela, qtd_total, valor, vencimento) VALUES (?,?,?,?,?)",
              [vendaId, i+1, qtd, valorParcela, venc.toISOString().slice(0,10)]);
          }
        }

        if (cliente_id) {
          db.get("SELECT email, nome FROM clientes WHERE id = ?", [cliente_id], (e, cliente) => {
            if (!e && cliente && cliente.email) {
              const html = `<p>Olá ${cliente.nome},</p>
                <p>Sua compra em ${dataCompraIso} foi registrada com sucesso. Valor total: R$ ${total.toFixed(2)}.</p>
                <p>Sua garantia é de 3 meses a partir da data da compra.</p>
                <p>Obrigado!</p>`;
              enviarEmail(cliente.email, "Confirmação de Compra - Beta Investimentos", html)
                .then(() => db.run("UPDATE vendas SET enviado_email_conclusao = 1 WHERE id = ?", [vendaId]))
                .catch(err => console.error("Erro enviando email de confirmação:", err.message));
            }
          });
        }

        return res.json({ vendaId, total, metodo_pagamento, data_compra: dataCompraIso });
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

app.get("/api/vendas", (req, res) => {
  db.all("SELECT * FROM vendas ORDER BY criado_em DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ----------------- Rotas: PARCELAS -----------------
app.get("/api/parcelas", (req, res) => {
  const vendaId = req.query.venda_id;
  const params = vendaId ? [vendaId] : [];
  const sql = `
    SELECT p.*, (SELECT COUNT(*) FROM parcelas pp WHERE pp.venda_id = p.venda_id) as qtd_total
    FROM parcelas p
    ${vendaId ? "WHERE p.venda_id = ?" : ""}
    ORDER BY p.vencimento
  `;
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post("/api/parcelas/:id/pagar", (req, res) => {
  db.run("UPDATE parcelas SET status='paga' WHERE id=?", [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ----------------- NOVA ROTA: LEADS -----------------
app.post("/api/leads", (req, res) => {
  const { google_id, nome, email, picture, telefone } = req.body;
  if (!email) return res.status(400).json({ error: "Email do lead é necessário." });

  const upsert = `
    INSERT INTO leads (google_id, nome, email, picture, telefone)
    VALUES (?,?,?,?,?)
    ON CONFLICT(email) DO UPDATE SET
      google_id = excluded.google_id,
      nome = excluded.nome,
      picture = excluded.picture,
      telefone = excluded.telefone
  `;
  db.run(upsert, [google_id || null, nome || null, email, picture || null, telefone || null], function(err) {
    if (err) return res.status(500).json({ error: err.message });

    db.get("SELECT * FROM leads WHERE email = ?", [email], (e, row) => {
      if (e) return res.status(500).json({ error: e.message });

      try {
        const html = `<p>Olá ${nome || ''},</p>
          <p>Obrigado por se conectar com a Beta Investimentos. Em breve entraremos em contato.</p>`;
        if (GMAIL_USER && GMAIL_PASS) {
          enviarEmail(email, "Bem-vindo à Beta Investimentos", html)
            .then(()=> console.log("Email de boas-vindas enviado para lead:", email))
            .catch(ex => console.error("Erro ao enviar boas-vindas:", ex.message));
        }
      } catch(ex) { console.error(ex); }

      return res.json({ lead: row });
    });
  });
});

// ----------------- Relatórios -----------------
app.get("/api/relatorios/lucros", (req, res) => {
  db.get("SELECT SUM(total) as entradas, SUM(lucro) as lucro FROM vendas", (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

// ----------------- Cron: lembretes -----------------
function ymd(d){ return d.toISOString().slice(0,10); }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }

cron.schedule("0 8 * * *", () => {
  console.log("Cron: verificando lembretes (vendas/parcelas)...");
  const hoje = new Date();
  const amanha = ymd(addDays(hoje, 1));
  const hojeYmd = ymd(hoje);

  const sqlVPre = `
    SELECT v.id, v.total, v.vencimento, v.metodo_pagamento, c.email, c.nome
    FROM vendas v
    LEFT JOIN clientes c ON v.cliente_id = c.id
    WHERE v.vencimento IS NOT NULL
      AND v.metodo_pagamento IN ('pix','cartao','dinheiro')
      AND v.enviado_email_pre_vencimento = 0
      AND v.vencimento = ?
  `;
  db.all(sqlVPre, [amanha], (err, rows) => {
    if (err) return console.error(err.message);
    rows.forEach(r => {
      if (!r.email) return;
      const html = `<p>Olá ${r.nome||''},</p>
        <p>Seu pagamento de R$ ${r.total.toFixed(2)} vence amanhã (${new Date(r.vencimento).toLocaleDateString('pt-BR')}).</p>`;
      enviarEmail(r.email, "Lembrete: vence amanhã - Beta Investimentos", html)
        .then(()=> db.run("UPDATE vendas SET enviado_email_pre_vencimento = 1 WHERE id = ?", [r.id]))
        .catch(e => console.error("Erro enviar pré-venc (venda):", e.message));
    });
  });

  const sqlPPre = `
    SELECT p.id, p.num_parcela, p.qtd_total, p.valor, p.vencimento, c.email, c.nome
    FROM parcelas p
    JOIN vendas v ON v.id = p.venda_id
    LEFT JOIN clientes c ON v.cliente_id = c.id
    WHERE p.enviado_email_pre = 0 AND p.status='aberta' AND p.vencimento = ?
  `;
  db.all(sqlPPre, [amanha], (err, rows) => {
    if (err) return console.error(err.message);
    rows.forEach(r => {
      if (!r.email) return;
      const html = `<p>Olá ${r.nome||''},</p>
        <p>Lembrete: a parcela ${r.num_parcela}/${r.qtd_total} (R$ ${r.valor.toFixed(2)}) vence amanhã (${new Date(r.vencimento).toLocaleDateString('pt-BR')}).</p>`;
      enviarEmail(r.email, "Lembrete: parcela vence amanhã - Beta Investimentos", html)
        .then(()=> db.run("UPDATE parcelas SET enviado_email_pre = 1 WHERE id = ?", [r.id]))
        .catch(e => console.error("Erro enviar pré-venc (parcela):", e.message));
    });
  });

  const sqlPDia = `
    SELECT p.id, p.num_parcela, p.qtd_total, p.valor, p.vencimento, c.email, c.nome
    FROM parcelas p
    JOIN vendas v ON v.id = p.venda_id
    LEFT JOIN clientes c ON v.cliente_id = c.id
    WHERE p.enviado_email_dia = 0 AND p.status='aberta' AND p.vencimento = ?
  `;
  db.all(sqlPDia, [hojeYmd], (err, rows) => {
    if (err) return console.error(err.message);
    rows.forEach(r => {
      if (!r.email) return;
      const html = `<p>Olá ${r.nome||''},</p>
        <p>Hoje vence a parcela ${r.num_parcela}/${r.qtd_total} (R$ ${r.valor.toFixed(2)}).</p>`;
      enviarEmail(r.email, "Vencimento hoje - Beta Investimentos", html)
        .then(()=> db.run("UPDATE parcelas SET enviado_email_dia = 1 WHERE id = ?", [r.id]))
        .catch(e => console.error("Erro enviar dia (parcela):", e.message));
    });
  });

});

// ----------------- Inicialização -----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`GMAIL_USER=${GMAIL_USER ? '[configured]' : '[not configured]'} - use GMAIL_USER + GMAIL_PASS (senha de app)`);
});
