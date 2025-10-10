// src/models/Agenda.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const AgendaSchema = new Schema(
  {
    venda: { 
      type: Schema.Types.ObjectId, 
      ref: "Venda", 
      required: false 
    },

    parcela: { 
      type: Schema.Types.ObjectId, 
      ref: "Parcela", // facilita o populate direto se houver model de parcelas
      required: false 
    },

    titulo: { 
      type: String, 
      required: true 
    },

    descricao: { 
      type: String, 
      default: "" 
    },

    data: { 
      type: Date, 
      required: true 
    },

    status: { 
      type: String, 
      enum: ["agendado", "concluido", "cancelado"], 
      default: "agendado" 
    },

    tipo: { 
      type: String, 
      enum: ["parcela", "venda_carne"], 
      default: "parcela" 
    },

    valor: { 
      type: Number, 
      required: false 
    },

    clienteNome: { 
      type: String, 
      required: false 
    },

    clienteId: { 
      type: Schema.Types.ObjectId, 
      ref: "Cliente", 
      required: false 
    },

    observacao: { 
      type: String, 
      default: "" 
    }
  },
  { timestamps: true }
);

export default mongoose.models.Agenda || 
  mongoose.model("Agenda", AgendaSchema, "agendas");
