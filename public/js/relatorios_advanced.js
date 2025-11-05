// public/js/relatorios_advanced.js
// Frontend avançado para Relatórios - usa Chart.js v3
(function(){
  // ---------- CONFIG (ajuste rotas se necessário) ----------
  const API = {
    list: (from,to,page,limit) => `/api/relatorios/list?from=${encodeURIComponent(from||'')}&to=${encodeURIComponent(to||'')}&page=${page}&limit=${limit}`,
    summary: (from,to,gran) => `/api/relatorios/summary?from=${encodeURIComponent(from||'')}&to=${encodeURIComponent(to||'')}&granularity=${encodeURIComponent(gran||'day')}`,
    clients: () => `/api/clients?top=500`,
    products: () => `/api/products?top=500`,
    // you may add endpoints to fetch single client/product by id if needed
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
  const cardVendas = $('#cardVendas'), cardReceita = $('#cardReceita'), cardLucro = $('#cardLucro'), cardTicket = $('#cardTicket'), cardMelhor = $('#cardMelhor'), cardTopProduto = $('#cardTopProduto');
  const pageNumEl = $('#pageNum'), rowsCountEl = $('#rowsCount');
  const btnPrev = $('#prevPage'), btnNext = $('#nextPage');

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

  // ---------- fetch wrapper ----------
  async function api(url){
    const res = await fetch(url, { credentials: 'same-origin' });
    if(!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
    return res.json();
  }

  // ---------- load autocomplete lists ----------
  async function loadAutocomplete(){
    try {
      const [cRes, pRes] = await Promise.allSettled([ api(API.clients()), api(API.products()) ]);
      if(cRes.status === 'fulfilled' && Array.isArray(cRes.value)) {
        cache.clients = cRes.value;
        clientsListEl.innerHTML = cache.clients.map(c => `<option value="${(c.name||c.nome||c.email||c._id)}">`).join('');
        cache.clients.forEach(c => cache.clientMap[c._id] = c);
      }
      if(pRes.status === 'fulfilled' && Array.isArray(pRes.value)) {
        cache.products = pRes.value;
        productsListEl.innerHTML = cache.products.map(p => `<option value="${(p.nome||p.name||p.title||p._id)}">`).join('');
        cache.products.forEach(p => cache.productMap[p._id] = p);
      }
    } catch (e) {
      console.warn('autocomplete load failed', e);
    }
  }
  loadAutocomplete();

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
    // returns array of product names (best-effort)
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
    // fallback: attempt first item fields
    if (sale.items && sale.items.length) return sale.items.map(it => it.name || it.produto || '');
    return [];
  }

  // ---------- profit calculation ----------
  // Returns object { revenue, cost, profit }
  function calcProfitForSale(sale){
    const revenue = Number(sale.total || sale.receita || sale.valor || sale.value || 0);
    let costSum = 0;
    let foundCost = false;

    // if sale.items with cost per item
    if (Array.isArray(sale.items) && sale.items.length) {
      sale.items.forEach(it => {
        const qty = Number(it.quantity || it.qtd || it.amount || 1);
        const cost = Number(it.cost || it.custo || it.cost_price || it.costValue || 0);
        if (cost) foundCost = true;
        costSum += qty * (cost || 0);
      });
    }

    // if sale.products contains cost
    if (!foundCost && Array.isArray(sale.products) && sale.products.length) {
      sale.products.forEach(p => {
        const qty = Number(p.quantity || p.qtd || p.qty || 1);
        const cost = Number(p.cost || p.custo || p.purchase_price || 0);
        if (cost) foundCost = true;
        costSum += qty * (cost || 0);
      });
    }

    // if sale has produto_id -> try lookup product in cache
    if (!foundCost && Array.isArray(sale.products) && sale.products.length === 0 && sale.produto_id) {
      // not implemented for multiple ids, but fallback
      const pid = sale.produto_id;
      const p = cache.productMap && cache.productMap[pid];
      if (p && (p.cost || p.custo || p.purchase_price)) {
        costSum = Number(p.cost || p.custo || p.purchase_price) * (sale.quantity || 1);
        foundCost = true;
      }
    }

    // if still no cost, attempt to compute approximate cost via product lookup when product names match cache
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
      // fallback: assume markup 30% => cost = revenue / 1.3 => profit = revenue - cost
      const assumedProfit = revenue * 0.30;
      const assumedCost = revenue - assumedProfit;
      return { revenue, cost: assumedCost, profit: assumedProfit, estimated: true };
    } else {
      const profit = revenue - costSum;
      return { revenue, cost: costSum, profit, estimated: false };
    }
  }

  // ---------- data aggregation helpers ----------
  function groupBy(list, fnKey) {
    return list.reduce((acc, item) => {
      const k = fnKey(item);
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    }, {});
  }

  function aggregateRevenueByPeriod(vendas, gran) {
    // gran: day/week/month
    const map = {};
    vendas.forEach(v => {
      const d = parseDate(v.criado_em || v.createdAt || v.created || v.date || v.criado || v.criado_em);
      if (!d || isNaN(d)) return;
      let key;
      if (gran === 'day') key = iso(d);
      else if (gran === 'week') {
        // monday date as key
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
      // nice label
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
    list.forEach(item => {
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
    vendas.forEach(v => {
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
    detailContent.innerHTML = `
      <div class="space-y-1">
        <div class="muted">Cliente</div><div class="text-lg font-bold">${getClientName(sale) || '—'}</div>
        <div class="muted">Produtos</div><div>${products}</div>
        <div class="muted">Total</div><div class="font-bold">${fmtCurrency(p.revenue)}</div>
        <div class="muted">Custo</div><div>${fmtCurrency(p.cost)} ${p.estimated ? '<span class="muted text-sm">(estimado)</span>' : ''}</div>
        <div class="muted">Lucro</div><div class="text-green-400 font-bold">${fmtCurrency(p.profit)}</div>
        <div class="muted">Data</div><div>${new Date(sale.criado_em||sale.createdAt||sale.date||sale.criado||'').toLocaleString()}</div>
      </div>
    `;
    if (focusCharts) {
      // focus charts to show only this sale: re-render charts with array [sale]
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
    // reload full set (call loadAll)
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
      btnSearch.disabled = true;
      // from/to behaviour:
      // if both empty => default last 30 days; if user clicked "Limpar datas" they will be empty and will fetch ALL (we treat clearDates flag)
      const fromVal = fromEl.value || '';
      const toVal = toEl.value || '';
      let from = fromVal, to = toVal;
      // default to last 30 days if both empty
      if (!from && !to) {
        const toD = new Date();
        const fromD = new Date(); fromD.setDate(toD.getDate() - 29);
        from = iso(fromD);
        to = iso(toD);
      }
      const gran = granEl.value || 'month';
      // fetch list (paginated)
      const res = await api(API.list(from,to,currentPage,currentLimit));
      const vendas = Array.isArray(res.vendas) ? res.vendas : (Array.isArray(res.rows) ? res.rows : []);
      // store vendas for rendering
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
      cardVendas.innerText = totalCount;
      cardReceita.innerText = fmtCurrency(totalRevenue);
      cardLucro.innerText = fmtCurrency(profitAgg);
      const ticket = totalCount ? (totalRevenue/totalCount) : 0;
      cardTicket.innerText = fmtCurrency(ticket);

      // best period - compute from aggregated periods
      const agg = aggregateRevenueByPeriod(filtered, gran);
      if (agg.length) {
        const best = agg.reduce((a,b)=> (b.revenue > a.revenue ? b : a), agg[0]);
        cardMelhor.innerText = `${best.label} (${fmtCurrency(best.revenue)})`;
      } else {
        cardMelhor.innerText = '—';
      }

      // top produto
      const topP = topBy(filtered, v => {
        const arr = getProductsFromSale(v); return arr.length ? arr[0] : '—';
      }, 1);
      cardTopProduto.innerText = (topP.length ? `${topP[0].key} (${fmtCurrency(topP[0].revenue)})` : '—');

      // render charts
      renderRevenueChart(agg);
      renderPaymentChart(filtered);
      renderTotalsChart(agg);
      renderTopProducts(filtered);
      renderTopClients(filtered);

      // render table
      renderTable(filtered, res.page || currentPage, res.limit || currentLimit);
    } catch (err) {
      console.error('loadAll error', err);
      alert('Erro ao carregar relatórios. Veja console.');
    } finally {
      btnSearch.disabled = false;
    }
  }

  // table renderer with click-to-focus
  function renderTable(vendas, page=1, limit=50) {
    pageNumEl.innerText = page;
    rowsCountEl.innerText = vendas.length;
    if (!Array.isArray(vendas) || vendas.length === 0) {
      salesBody.innerHTML = `<tr><td colspan="6">Nenhuma venda</td></tr>`;
      return;
    }
    salesBody.innerHTML = vendas.map((v, idx) => {
      const created = parseDate(v.criado_em||v.createdAt||v.created||v.date||v.criado);
      const cliente = getClientName(v) || '—';
      const produtos = getProductsFromSale(v).join(', ') || '—';
      const total = Number(v.total || v.receita || v.valor || v.value || 0);
      const tipo = v.tipo_pagamento || v.tipo || v.paymentType || v.payment || '—';
      const position = (page-1)*limit + idx + 1;
      const id = v._id || v.id || '';
      return `<tr class="clickable-row" data-id="${id}">
        <td>${position}</td>
        <td>${cliente}</td>
        <td>${produtos}</td>
        <td>${fmtCurrency(total)}</td>
        <td>${tipo}</td>
        <td>${created ? created.toLocaleString() : '—'}</td>
      </tr>`;
    }).join('');

    // add click handlers
    document.querySelectorAll('.clickable-row').forEach(tr => {
      tr.addEventListener('click', (e) => {
        const id = tr.dataset.id;
        // find sale object
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

  // allow clearing focusedSale by pressing Esc
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (saleDetail.classList.contains('open')) closeSaleDetail();
    }
  });

  // load initial (defaults)
  (async function init(){
    // initial behavior: leave date inputs empty (user asked to allow both options).
    // But by default we'll load last 30 days for convenience unless user clears.
    fromEl.value = ''; toEl.value = '';
    await loadAutocomplete();
    await loadAll();
  })();

})();
