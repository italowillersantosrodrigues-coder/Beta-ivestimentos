// server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import bodyParser from "body-parser";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import "./db/mongo.js";
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
    contentSecurityPolicy: false, // desativa CSP para permitir JS local
  })
);
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(process.cwd(), "public")));

// ================ AUTENTICAÇÃO JWT ================
function autenticarToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token não fornecido" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

// ================ ROTAS PRINCIPAIS =================

// 🔹 Registro e login
app.post("/api/auth/register", async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha)
      return res.status(400).json({ error: "Preencha todos os campos" });

    const existente = await User.findOne({ email });
    if (existente) return res.status(400).json({ error: "Email já cadastrado" });

    const senhaHash = await bcrypt.hash(senha, 10);
    const novo = await User.create({ nome, email, senhaHash });

    res.json({ message: "Usuário registrado com sucesso", user: novo });
  } catch (err) {
    console.error("Erro ao registrar:", err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// 🔹 Login manual via JWT (usuário comum)
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Informe email e senha" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Usuário não encontrado" });

    const ok = await user.validarSenha(password);
    if (!ok) return res.status(401).json({ error: "Senha incorreta" });

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ message: "Login bem-sucedido", token, user });
  } catch (err) {
    console.error("Erro no login:", err);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// 🔹 Login administrativo (rota separada)
app.use("/api/admin", authRouter);

// 🔹 Módulos do sistema
app.use("/api/clientes", clientsRouter);
app.use("/api/produtos", productsRouter);
app.use("/api/vendas", salesRouter);
app.use("/api/relatorios", reportsRouter);
app.use("/api/monitor", monitorRouter);
app.use("/api/templates", templatesRouter);

// 🔹 Exemplo de rota protegida
app.get("/api/perfil", autenticarToken, async (req, res) => {
  const user = await User.findById(req.user.id).select("-senhaHash");
  res.json(user);
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

// 404 genérico
app.use((req, res) => {
  res.status(404).sendFile(path.join(process.cwd(), "public", "Login.html"));
});

// =================== INICIALIZAÇÃO ===================
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
