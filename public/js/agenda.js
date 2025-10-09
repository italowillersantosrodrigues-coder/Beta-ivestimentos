// public/js/agenda.js - versão melhorada (CRUD, filtros, export, visual)
(() => {
  // elementos
  const filterDate = document.getElementById('filterDate');
  const filterTech = document.getElementById('filterTech');
  const filterStatus = document.getElementById('filterStatus');
  const filterSearch = document.getElementById('filterSearch');
  const btnApply = document.getElementById('btnApply');
  const btnClear = document.getElementById('btnClear');
  const btnNew = document.getElementById('btnNew');
  const btnLoadQuick = document.getElementById('btnLoadQuick');
  const quickDate = document.getElementById('quickDate');
  const btnReload = document.getElementById('btnReload');

  const tableBody = document.querySelector('#eventsTable tbody');
  const cardsGrid = document.getElementById('cardsGrid');
  const tableView = document.getElementById('tableView');
  const cardsView = document.getElementById('cardsView');

  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const form = document.getElementById('formAgenda');
  const evId = document.getElementById('evId');
  const evDate = document.getElementById('evDate');
  const evTime = document.getElementById('evTime');
  const evClient = document.getElementById('evClient');
  const evTech = document.getElementById('evTech');
  const evDesc = document.getElementById('evDesc');
  const evValue = document.getElementById('evValue');
  const evStatus = document.getElementById('evStatus');

  const btnCancelModal = document.getElementById('btnCancelModal');
  const btnSaveEvent = document.getElementById('btnSaveEvent');

  const btnToggleView = document.getElementById('btnToggleView');
  const viewCardsBtn = document.getElementById('viewCards');
  const viewTableBtn = document.getElementById('viewTable');

  const exportCsv = document.getElementById('exportCsv');
  const exportXlsx = document.getElementById('exportXlsx');
  const exportPdf = document.getElementById('exportPdf');

  const countTotal = document.getElementById('countTotal');
  const countPending = document.getElementById('countPending');
  const sumValue = document.getElementById('sumValue');

  // estado local
  let events = []; // todos os eventos carregados
  let technicians = []; // lista de técnicos (opt)
  let view = 'table'; // 'table' | 'cards'

  // util
  const fmtCurrency = v => Number(v || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  const dateTimeToISO = (d,t) => {
    if (!d) return null;
    if (!t) return d;
    return `${d}T${t}:00`;
  };

  // fetch helpers
  async function safeFetch(url, opts) {
    try {
      const r = await fetch(url, opts);
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(txt || r.statusText);
      }
      return r.json().catch(()=>null);
    } catch (err) {
      console.error('fetch error', err);
      alert('Erro na requisição: ' + (err.message || err));
      throw err;
    }
  }

  // carregamento inicial
  async function init() {
    // popular técnicos (se existir API)
    try {
      const techs = await fetch('/api/technicians').then(r => r.ok ? r.json() : []);
      technicians = Array.isArray(techs) ? techs : [];
    } catch (e) {
      technicians = [];
    }
    populateTechs();
    // set quick date default = hoje
    const hoje = new Date().toISOString().slice(0,10);
    quickDate.value = hoje;
    filterDate.value = hoje;
    // carregar dados iniciais (puxa tudo do dia atual)
    await loadEvents({ date: hoje });
  }

  function populateTechs(){
    [filterTech, evTech].forEach(sel => {
      if (!sel) return;
      sel.innerHTML = '<option value="">— Todos —</option>';
      technicians.forEach(t => {
        const o = document.createElement('option');
        o.value = t.id || t.name || t.email || t;
        o.textContent = t.name || t;
        sel.appendChild(o);
      });
    });
  }

  async function loadEvents({ date } = {}) {
    // tenta puxar por /api/monitor?date=YYYY-MM-DD
    try {
      const url = date ? `/api/monitor?date=${encodeURIComponent(date)}` : '/api/monitor';
      const data = await safeFetch(url);
      // espera um array. se estrutura diferente, adapta.
      if (Array.isArray(data)) {
        // converte para formato local
        events = data.map(mapIncomingEvent);
      } else if (data && Array.isArray(data.debts)) {
        // antiga estrutura { debts: [...] }
        events = (data.debts || []).map(mapIncomingEvent);
      } else {
        // se veio objeto único ou vazio, tenta colocar em array
        events = data ? (Array.isArray(data.events) ? data.events.map(mapIncomingEvent) : [mapIncomingEvent(data)]) : [];
      }
    } catch (err) {
      // em erro, mantemos lista vazia
      events = [];
    }
    render();
  }

  function mapIncomingEvent(d){
    // tenta normalizar campos: id, dateTime, clientName, technician, description, value, status
    return {
      id: d.id ?? d._id ?? d.eventId ?? Math.random().toString(36).slice(2,9),
      dateTime: d.dueDate ?? d.datetime ?? d.dateTime ?? d.date ?? d.due_date ?? d.date_time ?? d.dateTimeISO ?? d.dateISO ?? null,
      clientName: d.customerName ?? d.client ?? d.clientName ?? d.name ?? d.customer ?? '',
      technician: d.technician ?? d.tech ?? d.responsible ?? '',
      description: d.description ?? d.desc ?? d.note ?? d.notes ?? '',
      value: (d.amount ?? d.value ?? d.price ?? 0),
      status: (d.status ?? d.state ?? 'pending')
    };
  }

  // filtros
  function getFilters(){
    return {
      date: filterDate.value || null,
      tech: filterTech.value || null,
      status: filterStatus.value || null,
      search: (filterSearch.value || '').toLowerCase().trim()
    };
  }

  function applyLocalFilters(list = events) {
    const { date, tech, status, search } = getFilters();
    return list.filter(ev => {
      // date compares by YYYY-MM-DD if provided
      if (date) {
        const evDate = ev.dateTime ? ev.dateTime.slice(0,10) : null;
        if (evDate !== date) return false;
      }
      if (tech) {
        const t = (ev.technician || '').toString();
        if (!t.includes(tech)) return false;
      }
      if (status) {
        if ((ev.status || '') !== status) return false;
      }
      if (search) {
        const hay = ((ev.clientName||'') + ' ' + (ev.description||'') + ' ' + (ev.technician||'')).toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }

  // render
  function render(){
    const list = applyLocalFilters();
    renderStats(list);
    renderTable(list);
    renderCards(list);
  }

  function renderStats(list){
    countTotal.textContent = `Eventos: ${list.length}`;
    const pend = list.filter(x => (x.status||'') === 'pending').length;
    countPending.textContent = `Pendentes: ${pend}`;
    const total = list.reduce((s,x)=> s + (Number(x.value)||0), 0);
    sumValue.textContent = `Total: ${fmtCurrency(total)}`;
  }

  function renderTable(list){
    tableBody.innerHTML = '';
    if (!list.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6" class="muted">Nenhum evento encontrado.</td>`;
      tableBody.appendChild(tr);
      return;
    }
    list.forEach(ev => {
      const tr = document.createElement('tr');

      const dt = ev.dateTime ? new Date(ev.dateTime) : null;
      const dateTxt = dt ? `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : '-';

      tr.innerHTML = `
        <td>${dateTxt}</td>
        <td><strong>${escapeHtml(ev.clientName)}</strong><div class="muted">${escapeHtml(ev.technician || '')}</div></td>
        <td>${escapeHtml(ev.description || '')}</td>
        <td>${fmtCurrency(ev.value)}</td>
        <td>${statusTag(ev.status)}</td>
        <td style="text-align:right">
          <button class="btn small" data-action="edit" data-id="${ev.id}"><i class="fa-solid fa-pen"></i></button>
          <button class="btn small ghost" data-action="clone" data-id="${ev.id}" title="Duplicar"><i class="fa-solid fa-clone"></i></button>
          <button class="btn small danger" data-action="delete" data-id="${ev.id}"><i class="fa-solid fa-trash"></i></button>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    // delegação de eventos (ações)
    tableBody.querySelectorAll('button').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const ev = events.find(x => x.id == id);
      if (!ev) return alert('Evento não encontrado');
      if (action === 'edit') openModalWith(ev);
      if (action === 'clone') openModalWith(Object.assign({}, ev, { id: null }));
      if (action === 'delete') {
        if (!confirm('Excluir evento?')) return;
        await deleteEvent(ev);
      }
    }));
  }

  function renderCards(list){
    cardsGrid.innerHTML = '';
    if (!list.length) {
      cardsGrid.innerHTML = `<div class="muted">Nenhum evento encontrado.</div>`;
      return;
    }
    list.forEach(ev => {
      const dt = ev.dateTime ? new Date(ev.dateTime) : null;
      const card = document.createElement('div');
      card.className = 'event-card';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h4>${escapeHtml(ev.clientName || '—')}</h4>
          <div>${statusTag(ev.status)}</div>
        </div>
        <div class="muted" style="margin-bottom:6px">${dt ? dt.toLocaleString() : '-'}</div>
        <div style="margin-bottom:8px">${escapeHtml(ev.description || '')}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div class="muted">${escapeHtml(ev.technician || '')}</div>
          <div><strong>${fmtCurrency(ev.value)}</strong></div>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end">
          <button class="btn small" data-action="edit" data-id="${ev.id}"><i class="fa-solid fa-pen"></i></button>
          <button class="btn small ghost" data-action="clone" data-id="${ev.id}"><i class="fa-solid fa-clone"></i></button>
          <button class="btn small danger" data-action="delete" data-id="${ev.id}"><i class="fa-solid fa-trash"></i></button>
        </div>
      `;
      cardsGrid.appendChild(card);
      // actions
      card.querySelectorAll('button').forEach(b => b.addEventListener('click', async () => {
        const id = b.dataset.id;
        const action = b.dataset.action;
        const ev2 = events.find(x => x.id == id);
        if (!ev2) return alert('Evento não encontrado');
        if (action === 'edit') openModalWith(ev2);
        if (action === 'clone') openModalWith(Object.assign({}, ev2, { id: null }));
        if (action === 'delete') {
          if (!confirm('Excluir evento?')) return;
          await deleteEvent(ev2);
        }
      }));
    });
  }

  function statusTag(status){
    if (!status) status = 'pending';
    if (status === 'pending') return `<span class="tag pending">Pendente</span>`;
    if (status === 'done') return `<span class="tag done">Concluído</span>`;
    if (status === 'cancel') return `<span class="tag cancel">Cancelado</span>`;
    return `<span class="tag">${escapeHtml(status)}</span>`;
  }

  // CRUD: cria / atualiza / delete via /api/agenda (se disponível)
  async function createEvent(ev) {
    // tenta POST /api/agenda, senão grava local (temporário)
    try {
      const res = await fetch('/api/agenda', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(ev)
      });
      if (!res.ok) {
        // se erro, fallback local
        throw new Error(await res.text());
      }
      const created = await res.json();
      return mapIncomingEvent(created);
    } catch (err) {
      // fallback: cria id local e adiciona
      const local = Object.assign({}, ev, { id: Math.random().toString(36).slice(2,9) });
      return local;
    }
  }

  async function updateEvent(ev) {
    try {
      const url = `/api/agenda/${ev.id}`;
      const res = await fetch(url, {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(ev)
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      return mapIncomingEvent(updated);
    } catch (err) {
      // fallback local: replace by id
      return ev;
    }
  }

  async function deleteEvent(ev) {
    try {
      if (ev.id && typeof ev.id === 'string' && !ev.id.startsWith && ev.id.length < 6){
        // nothing
      }
      if (!ev.id) {
        // remove local by matching some fields
        events = events.filter(x => x !== ev);
        render();
        return;
      }
      const res = await fetch(`/api/agenda/${encodeURIComponent(ev.id)}`, { method:'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      // remove local
      events = events.filter(x => x.id !== ev.id);
      render();
    } catch (err) {
      // fallback: remove local
      events = events.filter(x => x.id !== ev.id);
      render();
    }
  }

  // modal helpers
  function openModalWith(ev = null){
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    if (ev) {
      modalTitle.textContent = ev.id ? 'Editar compromisso' : 'Duplicar / Novo compromisso';
      evId.value = ev.id || '';
      if (ev.dateTime) {
        const d = new Date(ev.dateTime);
        evDate.value = d.toISOString().slice(0,10);
        evTime.value = d.toTimeString().slice(0,5);
      } else {
        evDate.value = '';
        evTime.value = '';
      }
      evClient.value = ev.clientName || '';
      evTech.value = ev.technician || '';
      evDesc.value = ev.description || '';
      evValue.value = ev.value || '';
      evStatus.value = ev.status || 'pending';
    } else {
      modalTitle.textContent = 'Novo compromisso';
      form.reset();
      evId.value = '';
    }
  }

  function closeModal(){
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
  }

  // salvar do modal
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = evId.value || null;
    const date = evDate.value;
    const time = evTime.value;
    if (!date) return alert('Escolha uma data');
    const ev = {
      id,
      dateTime: dateTimeToISO(date, time),
      clientName: evClient.value.trim(),
      technician: evTech.value || '',
      description: evDesc.value || '',
      value: Number(evValue.value || 0),
      status: evStatus.value || 'pending'
    };

    try {
      if (!id) {
        // create
        const created = await createEvent(ev);
        events.push(created);
      } else {
        const updated = await updateEvent(ev);
        // substituir local
        const idx = events.findIndex(x => x.id == id);
        if (idx >= 0) events[idx] = updated;
      }
      render();
      closeModal();
    } catch (err) {
      alert('Erro ao salvar: ' + (err.message || err));
    }
  });

  // evento cancelar modal
  btnCancelModal.addEventListener('click', closeModal);
  modal.addEventListener('click', (ev) => {
    if (ev.target === modal) closeModal();
  });

  // novo
  btnNew.addEventListener('click', () => {
    form.reset();
    evId.value = '';
    evDate.value = filterDate.value || quickDate.value || new Date().toISOString().slice(0,10);
    evTime.value = '';
    openModalWith(null);
  });

  // filtros
  btnApply.addEventListener('click', render);
  btnClear.addEventListener('click', () => {
    filterDate.value = '';
    filterTech.value = '';
    filterStatus.value = '';
    filterSearch.value = '';
    render();
  });

  // quick load
  btnLoadQuick.addEventListener('click', async () => {
    const d = quickDate.value;
    if (!d) return alert('Escolha uma data rápida');
    filterDate.value = d;
    await loadEvents({ date: d });
  });

  btnReload.addEventListener('click', async () => {
    await loadEvents({ date: filterDate.value || quickDate.value || null });
  });

  // view toggles
  btnToggleView.addEventListener('click', () => {
    if (view === 'table') setView('cards'); else setView('table');
  });
  viewCardsBtn.addEventListener('click', () => setView('cards'));
  viewTableBtn.addEventListener('click', () => setView('table'));
  function setView(v){
    view = v;
    if (v === 'cards') {
      tableView.style.display = 'none';
      cardsView.style.display = 'block';
    } else {
      tableView.style.display = 'block';
      cardsView.style.display = 'none';
    }
  }

  // exports
  function buildExportRows(list){
    return list.map(ev => {
      const dt = ev.dateTime ? (new Date(ev.dateTime).toLocaleString()) : '';
      return {
        id: ev.id || '',
        date: dt,
        client: ev.clientName || '',
        technician: ev.technician || '',
        description: ev.description || '',
        value: Number(ev.value || 0),
        status: ev.status || ''
      };
    });
  }

  exportCsv.addEventListener('click', () => {
    const list = applyLocalFilters();
    const rows = buildExportRows(list);
    const csv = [
      ['id','data','cliente','tecnico','descricao','valor','status'],
      ...rows.map(r => [r.id, r.date, r.client, r.technician, `"${(r.description||'').replace(/"/g,'""')}"`, r.value.toFixed(2), r.status])
    ].map(a => a.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agenda_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  exportXlsx.addEventListener('click', () => {
    const list = applyLocalFilters();
    const rows = buildExportRows(list);
    const aoa = [['ID','Data','Cliente','Técnico','Descrição','Valor','Status'], ...rows.map(r => [r.id, r.date, r.client, r.technician, r.description, r.value, r.status])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agenda');
    XLSX.writeFile(wb, `agenda_${new Date().toISOString().slice(0,10)}.xlsx`);
  });

  exportPdf.addEventListener('click', async () => {
    const list = applyLocalFilters();
    const rows = buildExportRows(list);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'landscape' });
    doc.setFontSize(12);
    doc.text('Agenda - Export', 14, 16);
    const startY = 24;
    let y = startY;
    const rowHeight = 8;
    doc.setFontSize(10);
    doc.text(['Data','Cliente','Técnico','Descrição','Valor','Status'].join(' | '), 14, y);
    y += rowHeight;
    rows.forEach(r => {
      const line = [r.date, r.client, r.technician, (r.description||'').slice(0,60), fmtCurrency(r.value), r.status].join(' | ');
      doc.text(line, 14, y);
      y += rowHeight;
      if (y > 180) { doc.addPage(); y = 20; }
    });
    doc.save(`agenda_${new Date().toISOString().slice(0,10)}.pdf`);
  });

  // helper escape
  function escapeHtml(s){
    if (!s && s !== 0) return '';
    return String(s)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  // inicialização
  init();

  // util para mapIncomingEvent exposto aqui (já definida acima)
  // expose load for manual calls (debug)
  window.Agenda = {
    reload: () => loadEvents({ date: filterDate.value || quickDate.value || null }),
    getEvents: () => events
  };
})();
