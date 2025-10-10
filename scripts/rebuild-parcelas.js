// scripts/rebuild-parcelas.js
import mongoose from 'mongoose';
import process from 'process';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/minha_loja';
const dryRun = process.argv.includes('--dry');

function isCarne(metodo) {
  if (!metodo) return false;
  const m = metodo.toString().toLowerCase();
  return m.includes('carne') || m.includes('carnê') || m.includes('carnE') || m.includes('carne');
}

function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
}

async function run() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;
  console.log('Conectado a', MONGO_URI, 'dryRun=', dryRun);

  // Model flexível (strict:false) apontando pra collection já existente
  const Venda = mongoose.model('Venda', new mongoose.Schema({}, { strict: false }), 'vendas');
  const Agenda = mongoose.model('Agenda', new mongoose.Schema({}, { strict: false }), 'agendas');

  const cursor = Venda.find().cursor();
  let inspected = 0, toCreate = 0, createdParc = 0, createdAgenda = 0;

  for await (const v of cursor) {
    inspected++;
    const vendaId = v._id;
    // Detecta se existe o array parcelas e se está vazio
    const parcelasArray = Array.isArray(v.parcelas) ? v.parcelas : null;
    // heurísticas para número de parcelas
    const parcelasNum = Number(v.parcelas_num || v.parcelasCount || v.installments || v.numero_parcelas || v.parcelas_qt || v.qtd_parcelas || (Array.isArray(v.parcelas) ? v.parcelas.length : undefined) || v.parcelas_total) || Number(v.parcelasInt) || 1;
    // heurística para total
    const total = Number(v.total || v.valor || v.amount || v.totalValue);
    const metodo = v.tipo_pagamento || v.metodoPagamento || v.paymentMethod || v.forma_pagamento || '';

    // se já tem parcelas preenchidas, pula
    if (Array.isArray(parcelasArray) && parcelasArray.length > 0) continue;

    // se não tem total ou parcelasNum <= 1, normalmente não precisa criar parcelamento
    if (!total || parcelasNum <= 1) continue;

    console.log(`Venda ${vendaId.toString()} -> precisa gerar ${parcelasNum} parcelas (total=${total}) metodo="${metodo}"`);

    toCreate++;

    // calcular valores (arredondamento; diferença na última)
    const baseValor = Math.floor((total / parcelasNum) * 100) / 100;
    const valores = Array(parcelasNum).fill(baseValor);
    const somaBase = baseValor * parcelasNum;
    const diff = Math.round((total - somaBase) * 100) / 100;
    if (diff !== 0) valores[parcelasNum - 1] = Math.round((valores[parcelasNum - 1] + diff) * 100) / 100;

    // primeira parcela data heurística
    const startDate = v.primeiraParcelaDate || v.data_venda || v.criado_em || v.createdAt || new Date();

    const parcelasDocs = [];
    for (let i = 0; i < parcelasNum; i++) {
      const parcela = {
        _id: new mongoose.Types.ObjectId(),
        numero: i + 1,
        valor: valores[i],
        vencimento: addMonths(startDate, i),
        status: 'pendente'
      };
      parcelasDocs.push(parcela);
    }

    // dry-run: log do que faria
    if (dryRun) {
      console.log('  -> [DRY] Criaria', parcelasDocs.length, 'parcelas. Exemplo 1:', parcelasDocs[0]);
      if (isCarne(metodo)) console.log('  -> [DRY] Criaria agenda consolidada (venda_carne) e possivelmente agendas por parcela.');
      continue;
    }

    // Atualiza venda: setar campo parcelas = parcelasDocs
    await db.collection('vendas').updateOne({ _id: vendaId }, { $set: { parcelas: parcelasDocs, updatedAt: new Date() } });
    createdParc += parcelasDocs.length;

    // Criar agenda consolidada se for carnê
    if (isCarne(metodo)) {
      const agendaDoc = {
        venda: vendaId,
        parcela: null,
        titulo: `Carnê - Venda ${vendaId.toString()} - ${parcelasNum}x`,
        descricao: `Total R$ ${Number(total).toFixed(2)} - ${parcelasNum} parcelas`,
        data: parcelasDocs[0].vencimento,
        status: 'agendado',
        tipo: 'venda_carne',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await Agenda.create(agendaDoc);
      createdAgenda++;
    }

    // opcional: criar agenda por parcela (descomente se quiser criar agendas individuais)
    /*
    for (const p of parcelasDocs) {
      await Agenda.create({
        venda: vendaId,
        parcela: p._id,
        titulo: `Parcela ${p.numero}/${parcelasNum} - Venda ${vendaId.toString()}`,
        descricao: `Valor R$ ${p.valor.toFixed(2)}`,
        data: p.vencimento,
        status: 'agendado',
        tipo: 'parcela',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      createdAgenda++;
    }
    */
  }

  console.log('Inspecionado:', inspected, 'vendas que requerem criação:', toCreate, 'parcelas criadas (total):', createdParc, 'agendas criadas:', createdAgenda);

  await mongoose.disconnect();
  console.log('Concluído');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
