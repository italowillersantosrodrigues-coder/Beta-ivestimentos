// src/models/client.js
import mongoose from 'mongoose';

const enderecoSchema = new mongoose.Schema({
  rua: String,
  numero: String,
  complemento: String,
  bairro: String,
  cidade: String,
  estado: String,
  cep: String
}, { _id: false });

const clienteSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  telefone: { type: String, trim: true },
  cpfCnpj: { type: String, trim: true }, // opcional: CPF/CNPJ
  endereco: enderecoSchema,
  notas: { type: String },
}, {
  timestamps: true // createdAt e updatedAt
});

// Evita OverwriteModelError em hot-reload / múltiplos imports
const Cliente = mongoose.models.Cliente || mongoose.model('Cliente', clienteSchema);

export default Cliente;
