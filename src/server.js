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

import startVendaWatcher from "./services/vendaWatcher.js"; // Watcher para vendas
import User from "./models/User.js";

// ===== Conexão com MongoDB =====
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://italowillersantosrodrigues_db_user:Vlz2gPjUHvCXCxFV@beta-investimentos.nsgmg0d.mongodb.net/minha_loja?retryWrites=true&w=majority&appName=beta-investimentos";

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Conectado ao MongoDB Atlas: minha_loja"))
  .catch((err) => console.error("❌ Erro ao conectar ao MongoDB:", err));

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

// Servir arquivos estáticos da pasta "public"
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

// =================== ROTAS ===================
import authRouter from "./routes/auth.js";
import clientsRouter from "./routes/clients.js";
import productsRouter from "./routes/products.js";
import vendasRouter from "./routes/vendas.js";
import reportsRouter from "./routes/reports.js";
import monitorRouter from "./routes/monitor.js";
import templatesRouter from "./routes/templates.js";

app.use("/api/admin", authRouter);
app.use("/api/clientes", clientsRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/produtos", productsRouter);
app.use("/api/vendas", vendasRouter);
app.use("/api/relatorios", reportsRouter);
app.use("/api/monitor", monitorRouter);
app.use("/api/templates", templatesRouter);

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

const paginas = [
  "menu",
  "clientes",
  "produtos",
  "vendas",
  "agenda",
  "relatorios",
  "monitoramento",
];
paginas.forEach((p) => {
  app.get(`/${p}.html`, (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", `${p}.html`));
  });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(process.cwd(), "public", "Login.html"));
});

// =================== SERVIDOR HTTP + SOCKET.IO ===================
const httpServer = http.createServer(app);

const io = new IOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("🟢 Cliente conectado:", socket.id);
  socket.on("disconnect", () => {
    console.log("🔴 Cliente desconectado:", socket.id);
  });
});

// =================== WATCHER (Venda → Relatórios e Agenda) ===================
try {
  if (typeof startVendaWatcher === "function") {
    startVendaWatcher(mongoose.connection, io);
    console.log("🕵️‍♂️ Venda Watcher iniciado.");
  } else {
    console.warn("⚠️ startVendaWatcher não encontrado ou inválido.");
  }
} catch (err) {
  console.error("Erro ao iniciar vendaWatcher:", err);
}

// =================== INICIALIZAÇÃO ===================
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 Ambiente: ${process.env.NODE_ENV || "desenvolvimento"}`);
});

// =================== HANDLERS GLOBAIS ===================
process.on("uncaughtException", (err) => {
  console.error("uncaughtException:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection:", reason);
});

export default httpServer;
