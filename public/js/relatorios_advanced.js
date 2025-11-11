// public/js/relatorios_advanced.js
// Frontend avançado para Relatórios - usa Chart.js v3
(function(){
  // ---------- CONFIG (ajuste rotas se necessário) ----------
  const API = {
    list: (from,to,page,limit) => `/api/relatorios/list?from=${encodeURIComponent(from||'')}&to=${encodeURIComponent(to||'')}&page=${page}&limit=${limit}`,
    summary: (from,to,gran) => `/api/relatorios/summary?from=${encodeURIComponent(from||'')}&to=${encodeURIComponent(to||'')}&granularity=${encodeURIComponent(gran||'day')}`,
    clients: () => `/api/clients?top=500`,
    products: () => `/api/products?top=500`,
    // endpoints to persist override and expenses (adjust to backend)
    patchSale: (id) => `/api/relatorios/update?id=${encodeURIComponent(id)}`,
    patchSaleAlt: (id) => `/api/sales/${encodeURIComponent(id)}/override`,
    expenses: () => `/api/expenses`
  };

  // ---------- util helpers ----------
  const $ = s => document.querySelector(s);
  const fmtCurrency = v => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
  const parseDate = d => d ? new Date(d) : null;
  const iso = d => d ? d.toISOString().slice(0,10) : '';

  // ---------- elements ----------
  const fromEl = $('#from'), toEl = $('#to'), granEl = $('#gran'), btnSearch = $('#btnSearch'), btnRefresh = $('#btnRefresh');
  const filterClientEl = $('#filterClient'), filterProductEl = $('#filterProduct');
  const clientsListEl = $('#clientsList'), productsListEl = $('#productsList');
  const btnClearDates = $('#btnClearDates');
  const salesBody = $('#salesBody');
  const cardVendas = $('#cardVendas'), cardReceita = $('#cardReceita'), cardLucro = $('#cardLucro'), cardTicket = $('#cardTicket'), cardTopProduto = $('#cardTopProduto');
  const cardGastos = $('#cardGastos');
  const pageNumEl = $('#pageNum'), rowsCountEl = $('#rowsCount');
  const btnPrev = $('#prevPage'), btnNext = $('#nextPage');

  // expenses UI
  const btnToggleExpenses = $('#btnToggleExpenses'), expensesPanel = $('#expensesPanel');
  const expensesListEl = $('#expensesList'), btnAddExpense = $('#btnAddExpense'), btnClearExpenses = $('#btnClearExpenses');
  const expDateEl = $('#expDate'), expCategoryEl = $('#expCategory'), expDescEl = $('#expDesc'), expAmountEl = $('#expAmount');

  // charts contexts
  const ctxRevenue = document.getElementById('chartRevenue').getContext('2d');
  const ctxPayment = document.getElementById('chartPayment').getContext('2d');
  const ctxTotals = document.getElementById('chartTotals').getContext('2d');
  const ctxTopProducts = document.getElementById('chartTopProducts').getContext('2d');
  const ctxTopClients = document.getElementById('chartTopClients').getContext('2d');

  // chart instances
  let chartRevenue, chartPayment, chartTotals, chartTopProducts, chartTopClients;

  // pagination
  let currentPage = 1, currentLimit = 50;

  // cache
  const cache = { clients: [], products: [], clientMap: {}, productMap: {} };

  // sale focus state (when clicking a sale)
  let focusedSaleId = null;

  // expenses store (local by default), shape [{id, date, category, desc, amount}]
  let expenses = loadExpensesLocal();

  // ---------- fetch wrapper ----------
  async function api(url, opts){
    const res = await fetch(url, Object.assign({ credentials: 'same-origin' }, opts || {}));
    if(!res.ok) {
      const txt = await res.text().catch(()=>'');
      throw new Error(`API error ${res.status}: ${txt}`);
    }
    return res.json();
  }

  // ---------- normalize overrides on load ----------
  function normalizeOverrides(vendas){
    if(!Array.isArray(vendas)) return;
    vendas.forEach(sale => {
      if (sale._override) { /* already good */ }
      else if (sale.override) sale._override = sale.override;
      else if (sale.overrides) sale._override = sale.overrides;
      else if (typeof sale.override_profit !== 'undefined' || typeof sale.override_cost !== 'undefined') {
        sale._override = { profit: Number(sale.override_profit||0), cost: Number(sale.override_cost||0) };
      } else if (sale.meta && sale.meta.override) { sale._override = sale.meta.override; }
      if (sale._override) {
        sale._override.profit = Number(sale._override.profit||0);
        sale._override.cost = Number(sale._override.cost||0);
      }
    });
  }

  // ---------- load autocomplete ----------
  async function loadAutocomplete(){
    try {
      const [cRes, pRes] = await Promise.allSettled([ api(API.clients()), api(API.products()) ]);
      if(cRes.status === 'fulfilled' && Array.isArray(cRes.value)) {
        cache.clients = cRes.value;
        clientsListEl.innerHTML = cache.clients.map(c => `<option value="${(c.name||c.nome||c.email||c._id)}">`).join('');
        cache.clients.forEach(c => { if(c._id) cache.clientMap[c._id] = c; });
      }
      if(pRes.status === 'fulfilled' && Array.isArray(pRes.value)) {
        cache.products = pRes.value;
        productsListEl.innerHTML = cache.products.map(p => `<option value="${(p.nome||p.name||p.title||p._id)}">`).join('');
        cache.products.forEach(p => { if(p._id) cache.productMap[p._id] = p; });
      }
    } catch (e) {
      console.warn('autocomplete load failed', e);
    }
  }

  // ---------- helpers to extract client/product names from sale record ----------
  function getClientName(sale){
    if(!sale) return '';
    if(sale.cliente && typeof sale.cliente === 'string') return sale.cliente;
    if(sale.cliente && typeof sale.cliente === 'object') return sale.cliente.name || sale.cliente.nome || sale.cliente._id || '';
    if(sale.client) return typeof sale.client === 'string' ? sale.client : (sale.client.name || sale.client.nome || '');
    if(sale.cliente_name) return sale.cliente_name;
    if(sale.cliente_id && typeof sale.cliente_id === 'string') {
      const c = cache.clientMap[sale.cliente_id];
      return c ? (c.name || c.nome) : sale.cliente_id;
    }
    return '';
  }
  function getProductsFromSale(sale){
    if(!sale) return [];
    if (Array.isArray(sale.products) && sale.products.length) {
      return sale.products.map(p => (typeof p === 'string' ? p : (p.name||p.nome||p.title||p._id)));
    }
    if (Array.isArray(sale.items) && sale.items.length) {
      return sale.items.map(it => (it.name || it.produto || it.produto_name || (it.product && (it.product.name || it.product.nome))));
    }
    if (sale.produto) {
      if (Array.isArray(sale.produto)) return sale.produto.map(p => (typeof p === 'string' ? p : (p.name||p.nome)));
      if (typeof sale.produto === 'string') return [sale.produto];
      return [sale.produto.name||sale.produto.nome||JSON.stringify(sale.produto)];
    }
    if (sale.product) {
      if (Array.isArray(sale.product)) return sale.product.map(p => (p.name||p.nome||p._id));
      if (typeof sale.product === 'string') return [sale.product];
      return [sale.product.name||sale.product.nome||String(sale.product._id||'')];
    }
    if (sale.items && sale.items.length) return sale.items.map(it => it.name || it.produto || '');
    return [];
  }

  // ---------- profit calculation ----------
  // Returns object { revenue, cost, profit, estimated, overridden }
  function calcProfitForSale(sale){
    const revenue = Number(sale.total || sale.receita || sale.valor || sale.value || 0);

    // prefer override if present
    const override = (sale._override || sale.override || sale.overrides || null);
    if (override && (typeof override.profit !== 'undefined' || typeof override.cost !== 'undefined')) {
      const cost = Number(override.cost || 0);
      const profit = Number(override.profit !== undefined ? override.profit : (revenue - cost));
      return { revenue, cost, profit, estimated:false, overridden:true };
    }

    let costSum = 0;
    let foundCost = false;

    if (Array.isArray(sale.items) && sale.items.length) {
      sale.items.forEach(it => {
        const qty = Number(it.quantity || it.qtd || it.amount || 1);
        const cost = Number(it.cost || it.custo || it.cost_price || it.costValue || 0);
        if (cost) foundCost = true;
        costSum += qty * (cost || 0);
      });
    }

    if (!foundCost && Array.isArray(sale.products) && sale.products.length) {
      sale.products.forEach(p => {
        const qty = Number(p.quantity || p.qtd || p.qty || 1);
        const cost = Number(p.cost || p.custo || p.purchase_price || 0);
        if (cost) foundCost = true;
        costSum += qty * (cost || 0);
      });
    }

    if (!foundCost && Array.isArray(sale.products) && sale.products.length === 0 && sale.produto_id) {
      const pid = sale.produto_id;
      const p = cache.productMap[pid];
      if (p && (p.cost || p.custo || p.purchase_price)) {
        costSum = Number(p.cost || p.custo || p.purchase_price) * (sale.quantity || 1);
        foundCost = true;
      }
    }

    if (!foundCost) {
      const names = getProductsFromSale(sale);
      for (const name of names) {
        const p = cache.products.find(x => {
          const n = (x.name||x.nome||'').toLowerCase();
          return n && name.toLowerCase().includes(n);
        });
        if (p && (p.cost || p.custo || p.purchase_price)) {
          const qty = 1;
          costSum += Number(p.cost || p.custo || p.purchase_price) * qty;
          foundCost = true;
        }
      }
    }

    if (!foundCost) {
      const assumedProfit = revenue * 0.30;
      const assumedCost = revenue - assumedProfit;
      return { revenue, cost: assumedCost, profit: assumedProfit, estimated: true, overridden:false };
    } else {
      const profit = revenue - costSum;
      return { revenue, cost: costSum, profit, estimated:false, overridden:false };
    }
  }

  // ---------- data aggregation helpers ----------
  function aggregateRevenueByPeriod(vendas, gran) {
    const map = {};
    (vendas||[]).forEach(v => {
      const d = parseDate(v.criado_em || v.createdAt || v.created || v.date || v.criado || v.criado_em);
      if (!d || isNaN(d)) return;
      let key;
      if (gran === 'day') key = iso(d);
      else if (gran === 'week') {
        const day = (d.getDay() + 6) % 7;
        const monday = new Date(d); monday.setDate(d.getDate() - day);
        key = iso(monday);
      } else { // month
        key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      }
      if (!map[key]) map[key] = { revenue:0, profit:0, count:0, label: key, dates: [] };
      const p = calcProfitForSale(v);
      map[key].revenue += Number(p.revenue || 0);
      map[key].profit += Number(p.profit || 0);
      map[key].count += 1;
      map[key].dates.push(d);
    });
    const arr = Object.keys(map).sort().map(k => {
      const o = map[k];
      let label = k;
      if (gran === 'month') {
        const [y,m] = k.split('-'); label = new Date(y, Number(m)-1, 1).toLocaleString('pt-BR',{month:'short', year:'numeric'});
      } else if (gran === 'week') {
        const d = new Date(k);
        label = `sem ${d.toLocaleDateString()}`;
      } else {
        label = new Date(k).toLocaleDateString();
      }
      return { key: k, label, revenue: o.revenue, profit: o.profit, count: o.count };
    });
    return arr;
  }

  function topBy(list, keyFn, top = 8) {
    const map = {};
    (list||[]).forEach(item => {
      const k = keyFn(item) || '—';
      const p = calcProfitForSale(item);
      if (!map[k]) map[k] = { key:k, revenue:0, profit:0, count:0 };
      map[k].revenue += Number(p.revenue||0);
      map[k].profit += Number(p.profit||0);
      map[k].count += 1;
    });
    return Object.values(map).sort((a,b)=>b.revenue - a.revenue).slice(0,top);
  }

  // ---------- render charts ----------
  function renderRevenueChart(dataPoints) {
    const labels = dataPoints.map(d=>d.label);
    const revenues = dataPoints.map(d=>Number(d.revenue||0));
    const profits = dataPoints.map(d=>Number(d.profit||0));
    if (chartRevenue) chartRevenue.destroy();
    chartRevenue = new Chart(ctxRevenue, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label:'Receita', data: revenues, fill:true, tension:0.2, borderColor:'#10b981', backgroundColor:'rgba(16,185,129,0.12)' },
          { label:'Lucro', data: profits, fill:true, tension:0.2, borderColor:'#f59e0b', backgroundColor:'rgba(245,158,11,0.12)' }
        ]
      },
      options: { responsive:true, plugins:{ tooltip:{ mode:'index', intersect:false } } }
    });
  }

  function renderPaymentChart(vendas) {
    const map = {};
    (vendas||[]).forEach(v => {
      const t = v.tipo_pagamento || v.tipo || v.paymentType || v.payment || '—';
      map[t] = (map[t]||0) + Number(v.total || v.receita || v.valor || v.value || 0);
    });
    const labels = Object.keys(map);
    const values = labels.map(l => map[l]);
    if (chartPayment) chartPayment.destroy();
    chartPayment = new Chart(ctxPayment, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'] }] },
      options: { responsive:true }
    });
  }

  function renderTotalsChart(dataPoints) {
    const labels = dataPoints.map(d=>d.label);
    const totals = dataPoints.map(d=>Number(d.revenue||0));
    if (chartTotals) chartTotals.destroy();
    chartTotals = new Chart(ctxTotals, {
      type: 'bar',
      data: { labels, datasets: [{ label:'Receita', data: totals, backgroundColor:'#3b82f6' }] },
      options: { responsive:true }
    });
  }

  function renderTopProducts(vendas) {
    const top = topBy(vendas, v => {
      const arr = getProductsFromSale(v);
      return arr.length ? arr[0] : '—';
    }, 8);
    const labels = top.map(t => t.key);
    const values = top.map(t => t.revenue);
    if (chartTopProducts) chartTopProducts.destroy();
    chartTopProducts = new Chart(ctxTopProducts, {
      type: 'bar',
      data: { labels, datasets: [{ label:'Receita', data: values, backgroundColor:'#10b981' }] },
      options: { indexAxis: 'y', responsive:true }
    });
  }

  function renderTopClients(vendas) {
    const top = topBy(vendas, v => getClientName(v) || '—', 8);
    const labels = top.map(t => t.key);
    const values = top.map(t => t.revenue);
    if (chartTopClients) chartTopClients.destroy();
    chartTopClients = new Chart(ctxTopClients, {
      type: 'bar',
      data: { labels, datasets: [{ label:'Receita', data: values, backgroundColor:'#6366f1' }] },
      options: { indexAxis: 'y', responsive:true }
    });
  }

  // ---------- UI: sale detail panel and focus ----------
  const saleDetail = $('#saleDetail'), detailContent = $('#detailContent'), btnCloseDetail = $('#btnCloseDetail'), btnResetFocus = $('#btnResetFocus');

  function openSaleDetail(sale, focusCharts = true) {
    focusedSaleId = sale._id || sale.id || null;
    saleDetail.classList.add('open');
    const p = calcProfitForSale(sale);
    const products = getProductsFromSale(sale).join(', ') || '—';

    const overriddenNote = p.overridden ? '<span class="badge ml-2">editado</span>' : (p.estimated ? '<span class="muted text-sm">(estimado)</span>' : '');

    detailContent.innerHTML = `
      <div class="space-y-1">
        <div class="muted">Cliente</div><div class="text-lg font-bold">${getClientName(sale) || '—'}</div>
        <div class="muted">Produtos</div><div>${products}</div>
        <div class="muted">Total</div><div class="font-bold">${fmtCurrency(p.revenue)}</div>
        <div class="muted">Custo</div>
        <div><input id="inpCost" type="number" step="0.01" class="p-2 rounded bg-gray-700 text-gray-200 w-full" value="${Number(p.cost||0)}" /> ${p.estimated ? '<span class="muted text-sm">(estimado)</span>' : ''}</div>
        <div class="muted">Lucro</div>
        <div><input id="inpProfit" type="number" step="0.01" class="p-2 rounded bg-gray-700 text-gray-200 w-full" value="${Number(p.profit||0)}" /> ${overriddenNote}</div>
        <div class="muted">Data</div><div>${new Date(sale.criado_em||sale.createdAt||sale.date||sale.criado||'').toLocaleString()}</div>

        <div class="flex gap-2 mt-2">
          <button id="btnSaveOverride" class="px-3 py-1 rounded bg-green-600">Salvar</button>
          <button id="btnClearOverride" class="px-3 py-1 rounded bg-gray-700">Remover edição</button>
        </div>

        <div id="saveMsg" class="text-sm text-green-400 mt-2 hidden">Salvo. (local e tentativa de envio ao servidor)</div>
        <div id="saveErr" class="text-sm text-red-400 mt-2 hidden">Erro ao salvar no servidor (salvo localmente).</div>
      </div>
    `;

    // wire automatic profit recalculation when cost changes
    const inpCost = document.getElementById('inpCost');
    const inpProfit = document.getElementById('inpProfit');

    function recalcProfitFromCost() {
      const cost = parseFloat(String(inpCost.value || '0').replace(',', '.')) || 0;
      const revenue = Number(p.revenue || 0);
      const profit = +(revenue - cost).toFixed(2);
      inpProfit.value = profit;
    }
    // recalc on input
    inpCost.addEventListener('input', recalcProfitFromCost);

    // Save override
    document.getElementById('btnSaveOverride').addEventListener('click', async () => {
      const costRaw = inpCost.value;
      const profitRaw = inpProfit.value;
      const cost = parseFloat(String(costRaw).replace(',','.') || 0) || 0;
      const profit = parseFloat(String(profitRaw).replace(',','.') || 0) || 0;

      // local update
      sale._override = { cost, profit };
      const cached = (window.__vendas_cache||[]).find(x => String(x._id||x.id||'') === String(sale._id||sale.id||''));
      if (cached) cached._override = sale._override;

      // try to persist to server using multiple strategies
      let savedOnServer = false;
      try {
        const res = await fetch("/api/relatorio-lucro", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    venda_id: venda._id,
    total: venda.total,
    custo: Number(inputCusto.value) || 0
  })
});

        if (res.ok) {
          const data = await res.json().catch(()=>null);
          if (data && (data._id || data.id)) {
            const idx = (window.__vendas_cache||[]).findIndex(x=>String(x._id||x.id||'')===String(data._id||data.id||''));
            if (idx !== -1) window.__vendas_cache[idx] = Object.assign(window.__vendas_cache[idx], data);
          }
          savedOnServer = true;
        } else {
          console.warn('PATCH primary failed', res.status);
        }
      } catch(e){ console.warn('PATCH primary error', e); }

      if (!savedOnServer) {
        // try alternative endpoint (if your API uses other URI)
        try {
          const alt = await fetch(API.patchSaleAlt(sale._id||sale.id||''), { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ cost, profit }) });
          if (alt.ok) {
            savedOnServer = true;
          } else console.warn('alt save failed', alt.status);
        } catch(e){ console.warn('alt save error', e); }
      }

      // final feedback
      if (savedOnServer) {
        document.getElementById('saveMsg').classList.remove('hidden');
        document.getElementById('saveErr').classList.add('hidden');
      } else {
        document.getElementById('saveMsg').classList.remove('hidden');
        document.getElementById('saveErr').classList.remove('hidden');
        // optionally persist override localStorage (not implemented here) - but kept in cache
      }

      // reload UI
      await loadAll();
    });

    // Clear override
    document.getElementById('btnClearOverride').addEventListener('click', async () => {
      if (sale._override) delete sale._override;
      const cached = (window.__vendas_cache||[]).find(x => String(x._id||x.id||'') === String(sale._id||sale.id||''));
      if (cached) delete cached._override;
      // try to remove from server
      try { await fetch(API.patchSale(sale._id||sale.id||''), { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ override: null }) }); } catch(e){}
      await loadAll();
    });

    if (focusCharts) {
      renderRevenueChart([{ label: 'Venda', revenue: p.revenue, profit: p.profit }]);
      renderPaymentChart([sale]);
      renderTotalsChart([{ label: 'Venda', revenue: p.revenue }]);
      renderTopProducts([sale]);
      renderTopClients([sale]);
    }
  }

  function closeSaleDetail() {
    saleDetail.classList.remove('open');
    focusedSaleId = null;
    loadAll();
  }

  btnCloseDetail.addEventListener('click', closeSaleDetail);
  btnResetFocus.addEventListener('click', () => {
    focusedSaleId = null;
    loadAll();
    saleDetail.classList.remove('open');
  });

  // ---------- main data loader (list + charts + cards) ----------
  async function loadAll() {
    try {
      if (btnSearch) btnSearch.disabled = true;
      const fromVal = fromEl.value || '';
      const toVal = toEl.value || '';
      let from = fromVal, to = toVal;
      if (!from && !to) {
        const toD = new Date();
        const fromD = new Date(); fromD.setDate(toD.getDate() - 29);
        from = iso(fromD);
        to = iso(toD);
      }
      const gran = granEl.value || 'month';
      // fetch list (paginated)
      let res;
      try {
        res = await api(API.list(from,to,currentPage,currentLimit));
      } catch (e) {
        console.error('API list error', e);
        res = {};
      }
      const vendas = Array.isArray(res.vendas) ? res.vendas : (Array.isArray(res.rows) ? res.rows : (Array.isArray(res) ? res : []));

      // normalize overrides (accept different server shapes)
      normalizeOverrides(vendas);

      window.__vendas_cache = vendas; // debugging

      // apply client/product filters on front-end to ensure correctness
      const clientSearch = (filterClientEl.value || '').trim().toLowerCase();
      const productSearch = (filterProductEl.value || '').trim().toLowerCase();
      let filtered = vendas;
      if (clientSearch) filtered = filtered.filter(v => (getClientName(v)||'').toLowerCase().includes(clientSearch));
      if (productSearch) filtered = filtered.filter(v => getProductsFromSale(v).join(', ').toLowerCase().includes(productSearch));

      // compute cards
      const totalCount = filtered.length;
      const totalRevenue = filtered.reduce((s,v) => s + Number(v.total || v.receita || v.valor || v.value || 0), 0);
      const profitAgg = filtered.reduce((s,v) => {
        const p = calcProfitForSale(v);
        return s + Number(p.profit || 0);
      }, 0);

      // compute expenses within from..to range
      const fromD = from ? new Date(from+'T00:00:00') : null;
      const toD = to ? new Date(to+'T23:59:59') : null;
      const expensesInRange = expenses.filter(ex => {
        const d = parseDate(ex.date);
        if (!d) return false;
        if (fromD && d < fromD) return false;
        if (toD && d > toD) return false;
        return true;
      });
      const expensesTotal = expensesInRange.reduce((s,e)=>s + Number(e.amount||0), 0);

      if (cardVendas) cardVendas.innerText = totalCount;
      if (cardReceita) cardReceita.innerText = fmtCurrency(totalRevenue);
      if (cardGastos) cardGastos.innerText = fmtCurrency(expensesTotal);

      // Lucro now = soma dos lucros (respeitando overrides) - gastos do período
      const lucroFinal = profitAgg - expensesTotal;
      if (cardLucro) cardLucro.innerText = fmtCurrency(lucroFinal);

      const ticket = totalCount ? (totalRevenue/totalCount) : 0;
      if (cardTicket) cardTicket.innerText = fmtCurrency(ticket);

      // top produto
      const topP = topBy(filtered, v => {
        const arr = getProductsFromSale(v); return arr.length ? arr[0] : '—';
      }, 1);
      if (cardTopProduto) cardTopProduto.innerText = (topP.length ? `${topP[0].key} (${fmtCurrency(topP[0].revenue)})` : '—');

      // render charts
      const agg = aggregateRevenueByPeriod(filtered, gran);
      renderRevenueChart(agg);
      renderPaymentChart(filtered);
      renderTotalsChart(agg);
      renderTopProducts(filtered);
      renderTopClients(filtered);

      // render table
      renderTable(filtered, res.page || currentPage, res.limit || currentLimit);

      // render expenses list
      renderExpensesList();

    } catch (err) {
      console.error('loadAll error', err);
      alert('Erro ao carregar relatórios. Veja console.');
    } finally {
      if (btnSearch) btnSearch.disabled = false;
    }
  }

  // table renderer with click-to-focus
  function renderTable(vendas, page=1, limit=50) {
    if (pageNumEl) pageNumEl.innerText = page;
    if (rowsCountEl) rowsCountEl.innerText = (vendas||[]).length;
    if (!Array.isArray(vendas) || vendas.length === 0) {
      salesBody.innerHTML = `<tr><td colspan="7">Nenhuma venda</td></tr>`;
      return;
    }
    salesBody.innerHTML = vendas.map((v, idx) => {
      const created = parseDate(v.criado_em||v.createdAt||v.created||v.date||v.criado);
      const cliente = getClientName(v) || '—';
      const produtos = getProductsFromSale(v).join(', ') || '—';
      const total = Number(v.total || v.receita || v.valor || v.value || 0);
      const p = calcProfitForSale(v);
      const tipo = v.tipo_pagamento || v.tipo || v.paymentType || v.payment || '—';
      const position = (page-1)*limit + idx + 1;
      const id = v._id || v.id || '';
      const profitDisplay = `${fmtCurrency(p.profit)} ${p.overridden ? '<span class="badge ml-2">editado</span>' : (p.estimated?'<span class="muted">(est)</span>':'')}`;
      return `<tr class="clickable-row" data-id="${id}">
        <td>${position}</td>
        <td>${cliente}</td>
        <td>${produtos}</td>
        <td>${fmtCurrency(total)}</td>
        <td>${profitDisplay}</td>
        <td>${tipo}</td>
        <td>${created ? created.toLocaleString() : '—'}</td>
      </tr>`;
    }).join('');

    // add click handlers
    document.querySelectorAll('.clickable-row').forEach(tr => {
      tr.addEventListener('click', (e) => {
        const id = tr.dataset.id;
        const sale = (window.__vendas_cache || []).find(x => String(x._id||x.id||'') === String(id));
        if (sale) openSaleDetail(sale, true);
      });
    });
  }

  // ---------- pagination ----------
  btnPrev.addEventListener('click', async ()=> {
    if (currentPage > 1) { currentPage--; await loadAll(); }
  });
  btnNext.addEventListener('click', async ()=> {
    currentPage++; await loadAll();
  });

  // ---------- interactions ----------
  btnSearch.addEventListener('click', async () => { currentPage = 1; await loadAll(); });
  btnRefresh.addEventListener('click', async () => { await loadAutocomplete(); await loadAll(); });
  btnClearDates.addEventListener('click', () => { fromEl.value=''; toEl.value=''; });

  // expenses interactions
  btnToggleExpenses.addEventListener('click', () => expensesPanel.classList.toggle('hidden'));
  btnAddExpense.addEventListener('click', () => {
    const date = expDateEl.value || iso(new Date());
    const category = (expCategoryEl.value || 'outros').trim();
    const desc = (expDescEl.value || '').trim();
    const amount = Number(expAmountEl.value || 0);
    if (!date || !amount) { alert('Preencha data e valor do gasto.'); return; }
    const item = { id: 'local-'+Date.now(), date, category, desc, amount };
    expenses.push(item); saveExpensesLocal(); renderExpensesList(); loadAll();
    expDateEl.value=''; expCategoryEl.value=''; expDescEl.value=''; expAmountEl.value='';
    // try to push to API (non-blocking)
    try { fetch(API.expenses(), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(item) }); } catch(e){}
  });
  btnClearExpenses.addEventListener('click', () => { if(confirm('Limpar todos os gastos (apenas local)?')){ expenses = []; saveExpensesLocal(); renderExpensesList(); loadAll(); } });

  // allow clearing focusedSale by pressing Esc
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (saleDetail.classList.contains('open')) closeSaleDetail();
    }
  });

  function renderExpensesList(){
    if (!expenses.length) { expensesListEl.innerHTML = '<div class="text-sm text-gray-400">Sem gastos cadastrados.</div>'; return; }
    expensesListEl.innerHTML = expenses.map(e => `<div class="flex justify-between items-center p-1"><div><div class="text-sm">${new Date(e.date).toLocaleDateString()} — <span class="muted">${e.category}</span></div><div class="text-xs text-gray-300">${e.desc||''}</div></div><div class="text-right"><div class="font-bold">${fmtCurrency(e.amount)}</div><div><button data-id="${e.id}" class="btnDelExp text-xs px-2 py-1 rounded bg-gray-700 mt-1">Excluir</button></div></div></div>`).join('');
    document.querySelectorAll('.btnDelExp').forEach(btn => btn.addEventListener('click', (ev)=>{ const id=btn.dataset.id; expenses = expenses.filter(x=>x.id!==id); saveExpensesLocal(); renderExpensesList(); loadAll(); }));
  }

  // ---------- expenses persistence (localStorage fallback) ----------
  function saveExpensesLocal(){ localStorage.setItem('relatorios_expenses', JSON.stringify(expenses)); }
  function loadExpensesLocal(){ try { return JSON.parse(localStorage.getItem('relatorios_expenses')||'[]') } catch(e){ return []; } }

  // ---------- init ----------
  (async function init(){
    fromEl.value = ''; toEl.value = '';
    // default expense date to today
    if (expDateEl) expDateEl.value = iso(new Date());
    renderExpensesList();
    await loadAutocomplete();
    await loadAll();
  })();

})();
