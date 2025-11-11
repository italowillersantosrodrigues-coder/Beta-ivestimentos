import mongoose from "mongoose";
const { Schema } = mongoose;

const RelatorioLucroSchema = new Schema({
  venda_id: { type: Schema.Types.ObjectId, ref: "Venda", required: true, unique: true },
  custo: { type: Number, default: 0 },
  lucro: { type: Number, default: 0 },
  atualizado_em: { type: Date, default: Date.now }
});

export default mongoose.models.RelatorioLucro ||
  mongoose.model("RelatorioLucro", RelatorioLucroSchema, "relatorios_lucro");
