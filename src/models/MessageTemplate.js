// src/models/MessageTemplate.js
import mongoose from 'mongoose';

const MessageTemplateSchema = new mongoose.Schema({
  key: { type: String, unique: true }, // e.g. 'sale_confirmation', 'installment_reminder'
  subject: { type: String }, // assunto email
  body: { type: String },    // texto (pode usar {{placeholders}})
  channel: { type: String, enum: ['email','whatsapp','both'], default: 'both' }
}, { timestamps: true });

export default mongoose.model('MessageTemplate', MessageTemplateSchema);
