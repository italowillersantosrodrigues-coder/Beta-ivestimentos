import mongoose from 'mongoose';

const Address = new mongoose.Schema({
  street: String,
  city: String,
  state: String,
  zip: String
}, { _id: false });

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: String,
  whatsapp: String,
  email: String,
  cpf: String,
  address: Address,
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

// 👇 ESTA É A LINHA CORRETA PARA EXPRESS
const Client = mongoose.model('Client', clientSchema);
export default Client;
