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
    contentSecurityPolicy: false,
  })
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

// =================== ROTAS DE AUTENTICAÇÃO ===================

// Registro: cria senhaHash e salva
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

    const retorno = { ...novo.toObject() };
    delete retorno.senhaHash;
    delete retorno.passwordHash;
    delete retorno.senha;

    return res.status(201).json({ message: "Usuário registrado com sucesso", user: retorno });
  } catch (err) {
    console.error("Erro ao registrar:", err);
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

// Login robusto
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Informe email e senha" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Usuário não encontrado" });

    const storedHash = User.getAnyHash(user);
    if (!storedHash) {
      console.error("Login falhou: usuário sem hash de senha (email):", user.email);
      return res.status(403).json({ error: "Conta sem senha configurada. Solicite redefinição de senha." });
    }

    const ok = await bcrypt.compare(password, storedHash);
    if (!ok) return res.status(401).json({ error: "Senha incorreta" });

    const token = jwt.sign(
      { id: user._id, email: user.email, papel: user.papel },
      process.env.JWT_SECRET || "dev_secret",
      { expiresIn: "7d" }
    );

    const userSafe = user.toObject();
    delete userSafe.senhaHash;
    delete userSafe.passwordHash;
    delete userSafe.senha;

    return res.json({ message: "Login bem-sucedido", token, user: userSafe });
  } catch (err) {
    console.error("Erro no login:", err);
    return res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// Mantém rota admin importada
app.use("/api/admin", authRouter);

// =================== ROTAS DO SISTEMA ===================

// 🔧 Corrigido para alinhar com o frontend
// O frontend chama /api/clientes, então adicionamos um alias:
app.use("/api/clientes", clientsRouter); // ✅ novo alias
app.use("/api/clients", clientsRouter);  // ✅ mantém compatibilidade anterior

app.use("/api/produtos", productsRouter);
app.use("/api/vendas", salesRouter);
app.use("/api/relatorios", reportsRouter);
app.use("/api/monitor", monitorRouter);
app.use("/api/templates", templatesRouter);

// Rota protegida de perfil
app.get("/api/perfil", autenticarToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-senhaHash -passwordHash -senha");
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    return res.json(user);
  } catch (err) {
    console.error("GET /api/perfil error:", err);
    return res.status(500).json({ error: "Erro ao buscar usuário" });
  }
});

// =================== FRONTEND ===================
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "Login.html"));
});

const paginas = ["menu", "clientes", "produtos", "vendas", "agenda"];
paginas.forEach((p) => {
  app.get(`/${p}.html`, (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", `${p}.html`));
  });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(process.cwd(), "public", "Login.html"));
});

// =================== INICIALIZAÇÃO ===================
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 Ambiente: ${process.env.NODE_ENV || "desenvolvimento"}`);
});

process.on("uncaughtException", (err) => {
  console.error("uncaughtException:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection:", reason);
});

export default server;
