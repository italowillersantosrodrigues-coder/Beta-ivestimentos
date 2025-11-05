// src/server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import http from "http";
import { Server as IOServer } from "socket.io";

import "./db/mongo.js"; // Conexão com MongoDB (garante mongoose.connect já executado)

import User from "./models/User.js";

// ===== Importa todas as rotas principais =====
import authRouter from "./routes/auth.js";
import clientsRouter from "./routes/clients.js";
import productsRouter from "./routes/products.js";
import vendasRouter from "./routes/vendas.js";
import reportsRouter from "./routes/reports.js";
import monitorRouter from "./routes/monitor.js";
import templatesRouter from "./routes/templates.js";

// ====== NOVA ROTA ADICIONADA (AGENDA) ======
import agendaRouter from "./routes/agenda.js";

// ===== Importa watcher (criar src/services/vendaWatcher.js conforme instruções) =====
import startVendaWatcher from "./services/vendaWatcher.js";

const app = express();
const PORT = process.env.PORT || 3000;

// ================= MIDDLEWARES =================
app.use(
  helmet({
    contentSecurityPolicy: false, // evita bloqueios em dev
  })
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve arquivos estáticos da pasta "public"
app.use(express.static(path.join(process.cwd(), "public")));

// =================== AUTENTICAÇÃO JWT ===================
function autenticarToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Token não fornecido" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Token inválido" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Erro ao verificar token:", err?.message || err);
    return res.status(401).json({ error: "Token inválido" });
  }
}

// =================== ROTAS DE AUTENTICAÇÃO ===================

// Registro de usuário
app.post("/api/auth/register", async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha)
      return res.status(400).json({ error: "Preencha todos os campos" });

    const existente = await User.findOne({ email });
    if (existente) return res.status(400).json({ error: "Email já cadastrado" });

    const senhaHash = await bcrypt.hash(senha, 10);
    const novo = await User.create({ nome, email, senhaHash });

    const retorno = novo.toObject();
    delete retorno.senhaHash;
    delete retorno.passwordHash;
    delete retorno.senha;

    return res.status(201).json({
      message: "Usuário registrado com sucesso",
      user: retorno,
    });
  } catch (err) {
    console.error("Erro ao registrar:", err);
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

// Login robusto
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Informe email e senha" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Usuário não encontrado" });

    const storedHash =
      typeof User.getAnyHash === "function" ? User.getAnyHash(user) : user.senhaHash;

    if (!storedHash)
      return res
        .status(403)
        .json({ error: "Conta sem senha configurada. Solicite redefinição." });

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

// =================== OUTRAS ROTAS DO SISTEMA ===================
app.use("/api/admin", authRouter);
app.use("/api/clientes", clientsRouter);
app.use("/api/clients", clientsRouter); // compatibilidade antiga
app.use("/api/produtos", productsRouter);
app.use("/api/vendas", vendasRouter);
app.use("/api/relatorios", reportsRouter);
app.use("/api/monitor", monitorRouter);
app.use("/api/templates", templatesRouter);

// ====== NOVA LINHA ADICIONADA ======
app.use("/api/agenda", agendaRouter);

// =================== PERFIL ===================
app.get("/api/perfil", autenticarToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "-senhaHash -passwordHash -senha"
    );
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    return res.json(user);
  } catch (err) {
    console.error("GET /api/perfil error:", err);
    return res.status(500).json({ error: "Erro ao buscar usuário" });
  }
});

// =================== FRONTEND (HTMLs) ===================
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "Login.html"));
});

// Adiciona todas as páginas HTML conhecidas
const paginas = [
  "menu",
  "clientes",
  "produtos",
  "vendas",
  "agenda",
  "relatorios",
  "monitoramento", // adicionada para evitar erro ENOENT
];
paginas.forEach((p) => {
  app.get(`/${p}.html`, (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", `${p}.html`));
  });
});

// Fallback: redireciona para Login.html
app.use((req, res) => {
  res.status(404).sendFile(path.join(process.cwd(), "public", "Login.html"));
});

// =================== INICIALIZAÇÃO DO HTTP + SOCKET.IO + WATCHER ===================
// cria servidor http a partir do express app (necessário para socket.io)
const httpServer = http.createServer(app);

// inicializa o listener HTTP
const server = httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 Ambiente: ${process.env.NODE_ENV || "desenvolvimento"}`);
});

// configura socket.io (opcional — útil para emitir eventos 'agenda:new')
let io = null;
try {
  io = new IOServer(server, {
    cors: {
      origin: process.env.FRONTEND_ORIGIN || "*",
      methods: ["GET", "POST"],
    },
  });
  // disponibiliza io para outras partes da app via app.get('io')
  app.set("io", io);

  io.on("connection", (socket) => {
    console.log("Socket conectado:", socket.id);
    socket.on("disconnect", () => {
      console.log("Socket desconectado:", socket.id);
    });
  });
} catch (e) {
  console.warn("Socket.IO não inicializado:", e.message || e);
}

// startVendaWatcher usa mongoose.connection e o io (io é opcional)
try {
  if (typeof startVendaWatcher === "function") {
    startVendaWatcher(mongoose.connection, io);
    console.log("Venda watcher iniciado.");
  } else {
    console.warn("startVendaWatcher não é uma função — verifique import.");
  }
} catch (err) {
  console.error("Erro ao iniciar vendaWatcher:", err);
}

// =================== HANDLERS GLOBAIS ===================
process.on("uncaughtException", (err) => {
  console.error("uncaughtException:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection:", reason);
});

// exporta o server (compatibilidade com testes/pm2)
export default server;
