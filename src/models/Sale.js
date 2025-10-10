// models/Sale.js
import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    items: { type: [itemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },

    paymentType: {
      type: String,
      required: true,
      enum: ["avista", "cartao", "carne", "dinheiro", "pix", "transferencia"],
    },

    status: {
      type: String,
      enum: ["pendente", "pago", "cancelado"],
      default: "pendente",
    },

    discount: { type: Number, default: 0 },
    notes: { type: String },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Índices para acelerar relatórios
saleSchema.index({ createdAt: 1 });
saleSchema.index({ client: 1 });
saleSchema.index({ paymentType: 1 });
saleSchema.index({ status: 1 });

const Sale = mongoose.model("Sale", saleSchema);

export default Sale;
