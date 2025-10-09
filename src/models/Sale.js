import mongoose from 'mongoose';

const installmentSchema = new mongoose.Schema({
  number: Number,
  dueDate: Date,
  amount: Number,
  paid: { type: Boolean, default: false },
  paidAt: Date
}, { _id: false });

const itemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  description: String,
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  total: { type: Number, default: 0 }
}, { _id: false });

const saleSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  items: [itemSchema],
  totalAmount: { type: Number, default: 0 },
  paidAt: Date,
  paymentType: { type: String, enum: ['avista','parcelado','fiado','transferencia','cartao'], default: 'avista' },
  installments: [installmentSchema],
  status: { type: String, enum: ['open','completed','cancelled'], default: 'open' },
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Sale || mongoose.model('Sale', saleSchema);
