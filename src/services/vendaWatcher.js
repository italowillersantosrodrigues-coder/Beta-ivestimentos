// src/services/vendaWatcher.js
import mongoose from "mongoose";

/**
 * Observa a coleção de Vendas para criar relatórios e agenda automaticamente.
 * @param {mongoose.Connection} dbConnection - Conexão ativa do Mongoose
 * @param {import('socket.io').Server} io - Instância do Socket.IO (opcional)
 */
export default function startVendaWatcher(dbConnection, io) {
  if (!dbConnection || !dbConnection.collection) {
    console.error("❌ Conexão MongoDB inválida no VendaWatcher.");
    return;
  }

  console.log("👁️ Iniciando monitoramento de alterações na coleção 'vendas'...");

  const collection = dbConnection.collection("vendas");

  // Watcher de alterações
  const changeStream = collection.watch([], { fullDocument: "updateLookup" });

  changeStream.on("change", async (change) => {
    try {
      const relatorios = dbConnection.collection("relatorios");
      const agendasCol = dbConnection.collection("agendas");

      // ============= NOVA VENDA =============
      if (change.operationType === "insert") {
        const novaVenda = change.fullDocument;
        if (!novaVenda) return;

        console.log("🟢 Nova venda detectada:", novaVenda._id?.toString());

        // Evita duplicar relatório
        const existe = await relatorios.findOne({ venda_id: novaVenda._id });
        if (!existe) {
          await relatorios.insertOne({
            venda_id: novaVenda._id,
            cliente_id: novaVenda.cliente_id,
            total: novaVenda.total,
            tipo_pagamento: novaVenda.tipo_pagamento,
            status: novaVenda.status,
            criado_em: new Date(),
          });
          console.log("📊 Relatório criado com sucesso.");
        } else {
          console.log("⚠️ Relatório já existia, ignorando duplicação.");
        }

        if (io) io.emit("novaVenda", novaVenda);

        // Caso parcelado / carnê
        const tipo = String(novaVenda.tipo_pagamento || "").toLowerCase();
        if (
          (tipo.includes("carne") || tipo.includes("carnê") || tipo === "parcelado") &&
          Array.isArray(novaVenda.parcelas) &&
          novaVenda.parcelas.length > 0
        ) {
          console.log("💳 Venda parcelada/carnê detectada — criando parcelas na agenda...");

          const jaTem = await agendasCol.countDocuments({ venda: novaVenda._id });
          if (jaTem === 0) {
            const parcelasCards = novaVenda.parcelas.map((p, idx) => ({
              venda: novaVenda._id,
              titulo: `Parcela ${idx + 1}/${novaVenda.parcelas.length}`,
              descricao: `R$ ${Number(p.valor).toFixed(2)}`,
              data: new Date(p.vencimento),
              status: p.status || "agendado",
              tipo: "parcela",
              clienteId: novaVenda.cliente_id || null,
              valor: p.valor,
              criado_em: new Date(),
            }));

            await agendasCol.insertMany(parcelasCards);
            console.log(`📅 ${parcelasCards.length} parcelas lançadas na agenda.`);
            if (io) io.emit("novaParcela", parcelasCards);
          } else {
            console.log("⚠️ Parcelas já existiam para essa venda, ignorando duplicação.");
          }
        }
      }

      // ============= UPDATE =============
      if (change.operationType === "update") {
        const id = change.documentKey._id;
        const atualizacoes = change.updateDescription?.updatedFields || {};
        if (Object.keys(atualizacoes).length === 0) return;

        console.log(`🟠 Venda atualizada (${id}):`, atualizacoes);

        // Evita sobrescrita de campos ausentes
        await relatorios.updateOne(
          { venda_id: new mongoose.Types.ObjectId(id) },
          { $set: atualizacoes },
          { upsert: true }
        );

        if (io) io.emit("atualizacaoVenda", { id, atualizacoes });
      }

      // ============= DELETE =============
      if (change.operationType === "delete") {
        const id = change.documentKey._id;
        console.log(`🔴 Venda removida: ${id}`);

        await relatorios.deleteOne({ venda_id: new mongoose.Types.ObjectId(id) });
        await agendasCol.deleteMany({ venda: new mongoose.Types.ObjectId(id) });

        if (io) io.emit("vendaRemovida", { id });
      }
    } catch (err) {
      console.error("❌ Erro ao processar mudança em venda:", err);
    }
  });

  changeStream.on("error", (err) => {
    console.error("⚠️ Erro no watcher de vendas:", err);
  });

  changeStream.on("close", () => {
    console.warn("🛑 Watcher de vendas encerrado.");
  });
}
