// src/server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import "./db/mongo.js"; // Conexão com o MongoDB (executa ao importar)

import User from "./models/User.js";

// ===== Rotas da aplicação =====
import authRouter from "./routes/auth.js";
import clientsRouter from "./routes/clients.js";
import productsRouter from "./routes/products.js";
import salesRouter from "./routes/sales.js";
import reportsRouter from "./routes/reports.js";
import monitorRouter from "./routes/monitor.js";
import templatesRouter from "./routes/templates.js";

const app = express();
const PORT = process.env.PORT || 3000;

// ================= MIDDLEWARES =================
app.use(
  helmet({
    contentSecurityPolicy: false, // desativa CSP para permitir JS local (ajuste em produção)
  })
);

app.use(cors());

// body parsing nativo do express (substitui body-parser)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos (pasta public na raiz do projeto)
app.use(express.static(path.join(process.cwd(), "public")));

// =================== AUTENTICAÇÃO JWT ===================
function autenticarToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Token não fornecido" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Token não fornecido" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    req.user = decoded;
    return next();
  } catch (err) {
    console.error("Erro ao verificar token:", err?.message || err);
    return res.status(401).json({ error: "Token inválido" });
  }
}

// =================== ROTAS DE AUTENTICAÇÃO (rápidas) ===================

// Registro local (mantive seu fluxo)
app.post("/api/auth/register", async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ error: "Preencha todos os campos" });
    }

    const existente = await User.findOne({ email });
    if (existente) return res.status(400).json({ error: "Email já cadastrado" });

    const senhaHash = await bcrypt.hash(senha, 10);
    const novo = await User.create({ nome, email, senhaHash });

    return res.json({ message: "Usuário registrado com sucesso", user: novo });
  } catch (err) {
    console.error("Erro ao registrar:", err);
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

// Login local (mantive seu fluxo)
// Observação: no body você envia { email, password }
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Informe email e senha" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Usuário não encontrado" });

    const ok = await bcrypt.compare(password, user.senhaHash);
    if (!ok) return res.status(401).json({ error: "Senha incorreta" });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "7d" }
    );

    return res.json({ message: "Login bem-sucedido", token, user });
  } catch (err) {
    console.error("Erro no login:", err);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// Monta rota admin (mantive seu import)
app.use("/api/admin", authRouter);

// =================== ROTAS DO SISTEMA ===================
// OBS: mantenho o mesmo prefixo que você usa no front (/api/clientes etc.)
app.use("/api/clientes", clientsRouter);
app.use("/api/produtos", productsRouter);
app.use("/api/vendas", salesRouter);
app.use("/api/relatorios", reportsRouter);
app.use("/api/monitor", monitorRouter);
app.use("/api/templates", templatesRouter);

// 🔹 Rota de perfil protegida
app.get("/api/perfil", autenticarToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-senhaHash");
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    return res.json(user);
  } catch (err) {
    console.error("GET /api/perfil error:", err);
    return res.status(500).json({ error: "Erro ao buscar usuário" });
  }
});

// =================== FRONTEND ===================
// Página inicial → Login
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "Login.html"));
});

// Outras páginas do painel
const paginas = ["menu", "clientes", "produtos", "vendas", "agenda"];
paginas.forEach((p) => {
  app.get(`/${p}.html`, (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", `${p}.html`));
  });
});

// 🔹 404 genérico (fallback para SPA ou login)
app.use((req, res) => {
  res.status(404).sendFile(path.join(process.cwd(), "public", "Login.html"));
});

// =================== INICIALIZAÇÃO ===================
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 Ambiente: ${process.env.NODE_ENV || "desenvolvimento"}`);
});

// Boas práticas: captura erros inesperados e finaliza com log
process.on("uncaughtException", (err) => {
  console.error("uncaughtException:", err);
  // opcional: process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection:", reason);
  // opcional: process.exit(1);
});

export default server;
