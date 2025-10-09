// src/routes/sales.js

import express from 'express';
import Product from '../models/product.js'; 
import Sale from '../models/Sale.js';
import Client from '../models/client.js'; 
import Agenda from '../models/Agenda.js'; // Importação do modelo Mongoose Agenda

const router = express.Router();

// Rota POST para Criar Nova Venda (e integrar com Agenda/Lembretes)
router.post('/', async (req, res) => {
    try {
        const { 
            client, 
            items = [], 
            paymentType, 
            installmentsCount = 0, 
            firstDueDate 
        } = req.body;

        // --- 1. VALIDAÇÃO BÁSICA ---
        if (!client) return res.status(400).json({ error: 'Cliente é obrigatório.' });
        if (!paymentType) return res.status(400).json({ error: 'Tipo de pagamento é obrigatório.' });

        const validItems = items.filter(it => it.product && Number(it.quantity) > 0);
        if (validItems.length === 0) {
            return res.status(400).json({ error: 'Nenhum produto válido foi incluído na venda.' });
        }

        let totalAmount = 0;
        const processedItems = await Promise.all(validItems.map(async (it) => {
            
            const product = await Product.findById(it.product);
            
            // CORREÇÃO NAN: Garante que unitPrice é um número válido.
            const unitPrice = Number(it.unitPrice) || (product ? Number(product.preco) : 0);
            const qty = Number(it.quantity) || 1; 
            
            // Calcula o total do item e arredonda
            const totalItem = Math.round(unitPrice * qty * 100) / 100;

            // CORREÇÃO DESCRIPTION: Garante que o campo description nunca seja nulo.
            const itemDescription = String(it.description || (product ? product.nome : 'Produto não cadastrado')).trim();

            if (product) {
                // Atualiza estoque (assumindo que o campo é 'estoque')
                product.estoque = Math.max(0, (product.estoque || 0) - qty);
                await product.save();
            }

            totalAmount += totalItem;
            
            return {
                product: it.product || null,
                description: itemDescription, 
                quantity: qty,
                unitPrice,
                total: totalItem, 
            };
        }));
        
        totalAmount = Math.round(totalAmount * 100) / 100;

        // --- 2. SALVAR VENDA ---
        const sale = new Sale({
            client,
            items: processedItems,
            totalAmount, 
            paymentType, 
        });

        await sale.save();

        // --- 3. INTEGRAÇÃO COM A AGENDA (PARCELAMENTO - CARNÊ/PARCELADO) ---
        // Verifica se o pagamento é parcelado (usando 'carnê' ou 'parcelado')
        if (paymentType === 'carnê' || paymentType === 'parcelado') { 
            const numInstallments = Number(installmentsCount);
            const firstDate = new Date(firstDueDate);

            if (!numInstallments || numInstallments <= 0 || isNaN(firstDate.getTime())) {
                 console.warn(`[AGENDA] Dados de parcelamento inválidos. Lembretes não criados.`);
            } else {
                const installmentValue = Math.round((totalAmount / numInstallments) * 100) / 100;

                for (let i = 0; i < numInstallments; i++) {
                    const dueDate = new Date(firstDate);
                    dueDate.setMonth(firstDate.getMonth() + i); 
                    
                    const reminder = new Agenda({
                        client: sale.client,
                        sale: sale._id,
                        dueDate: dueDate, 
                        amount: installmentValue, 
                        description: `Parcela ${i + 1}/${numInstallments} - Venda #${sale._id.toString().slice(-5)}`,
                        status: 'Em aberto'
                    });
                    await reminder.save();
                }
                console.log(`[AGENDA] ${numInstallments} lembretes de parcelas criados.`);
            }
        }
        
        // --- 4. RETORNO ---
        res.status(201).json(sale);

    } catch (err) {
        console.error("ERRO CRÍTICO AO CRIAR VENDA:", err);
        let errorMessage = err.message || "Erro interno ao processar a venda.";
        if (err.name === 'ValidationError') {
            errorMessage = Object.values(err.errors).map(val => val.message).join('; ');
        }
        res.status(400).json({ error: errorMessage });
    }
});

export default router;