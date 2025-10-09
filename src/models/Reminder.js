import mongoose from 'mongoose';
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: String,
  price: { type: Number, required: true, default: 0 },
  stock: { type: Number, default: 0 },
  category: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Product || mongoose.model('Product', productSchema);
