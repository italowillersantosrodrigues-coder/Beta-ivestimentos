// src/models/Cliente.js
import mongoose from 'mongoose';

const clienteSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: String,
  telefone: String,
  // ... seus outros campos
}, { timestamps: true });

// Se o model já foi registrado (durante hot-reload / import duplicado), reutiliza-o
const Cliente = mongoose.models?.Cliente || mongoose.model('Cliente', clienteSchema);

export default Cliente;
