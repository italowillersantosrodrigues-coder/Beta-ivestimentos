import mongoose from 'mongoose';

const AgendaSchema = new mongoose.Schema({
    // Referência ao cliente
    client: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Client', 
        required: true 
    },
    // Referência à venda (parcela)
    sale: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Sale', 
        required: true 
    },
    // Nome do Lembrete/Parcela (Ex: "Parcela 1/4 - Venda #...")
    description: { 
        type: String, 
        required: true 
    }, 
    dueDate: { // Data de Vencimento
        type: Date, 
        required: true 
    }, 
    amount: { // Valor da Parcela
        type: Number, 
        required: true 
    },
    status: { 
        type: String, 
        default: 'Em aberto', 
        enum: ['Em aberto', 'Pago', 'Atrasado', 'Cancelado'] 
    },
    // Para controlar notificações futuras
    isNotificationSent: { 
        type: Boolean, 
        default: false 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
});

export default mongoose.model('Agenda', AgendaSchema);