// Exemplo (adapte ao seu arquivo Sale.js)
import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
    // ... outros campos de item
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    // CORREÇÃO: Garante que 'description' é obrigatório e precisa de um valor.
    description: { type: String, required: true }, 
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
}, { _id: false });

const saleSchema = new mongoose.Schema({
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    items: [itemSchema],
    totalAmount: { type: Number, required: true, min: 0 },
    // CORREÇÃO ENUM AQUI: Adiciona 'dinheiro' como um valor válido.
    paymentType: { 
        type: String, 
        required: true, 
        enum: ['avista', 'cartao', 'carnê', 'dinheiro'] 
    },
    // ... o restante do seu Schema
});

const Sale = mongoose.model('Sale', saleSchema);

export default Sale;