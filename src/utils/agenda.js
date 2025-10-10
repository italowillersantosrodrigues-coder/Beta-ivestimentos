import nodeCron from "node-cron";
import Venda from "../models/Venda.js";
import { sendMail } from "./mailer.js";
import dotenv from "dotenv";
dotenv.config();

const LOOKAHEAD = parseInt(process.env.REMINDER_LOOKAHEAD_DAYS || "1", 10);

export async function agendarCobranca(vendaId, parcelaNum, vencimento) {
  const now = new Date();
  const date = new Date(vencimento);
  const reminderDate = new Date(date);
  reminderDate.setDate(date.getDate() - LOOKAHEAD);

  if (reminderDate > now) {
    console.log(`💬 Cobrança da venda ${vendaId} parcela ${parcelaNum} agendada para ${reminderDate}`);
  }
}

// Cron job principal: roda diariamente
nodeCron.schedule("0 9 * * *", async () => {
  const hoje = new Date();
  const alvo = new Date(hoje);
  alvo.setDate(hoje.getDate() + LOOKAHEAD);

  const vendas = await Venda.find({
    "parcelas.vencimento": { $lte: alvo },
    "parcelas.status": "pendente",
    "parcelas.enviado_email": false,
  }).populate("cliente_id");

  for (const v of vendas) {
    for (const p of v.parcelas.filter(px => px.status === "pendente" && !px.enviado_email && px.vencimento <= alvo)) {
      if (!v.cliente_id?.email) continue;

      const msg = `
        <p>Olá ${v.cliente_id.nome},</p>
        <p>Esta é uma cobrança automática da <strong>Beta Investimentos</strong>.</p>
        <p>Sua parcela #${p.numero} no valor de <strong>R$ ${p.valor.toFixed(2)}</strong> vence em ${p.vencimento.toLocaleDateString()}.</p>
        <p>Entre em contato para confirmar o pagamento.</p>
      `;

      try {
        await sendMail({
          to: v.cliente_id.email,
          subject: `Lembrete de pagamento - Parcela ${p.numero}`,
          html: msg,
        });

        p.enviado_email = true;
        await v.save();
        console.log(`✅ E-mail enviado para ${v.cliente_id.email}`);
      } catch (e) {
        console.error("❌ Erro envio cobrança:", e.message);
      }
    }
  }
});
