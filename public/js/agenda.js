// public/js/agenda.js
(async function(){
  const q = (s)=>document.querySelector(s);
  const eventsTable = q('#eventsTable');
  const cardsCount = q('#countTotal');
  const pendingCount = q('#countPending');
  const sumValue = q('#sumValue');
  const btnNew = q('#btnNew');
  const modal = q('#modal');
  const form = q('#formAgenda');
  const evId = q('#evId');
  const evDate = q('#evDate');
  const evTime = q('#evTime');
  const evClient = q('#evClient');
  const evTech = q('#evTech');
  const evDesc = q('#evDesc');
  const evValue = q('#evValue');
  const evStatus = q('#evStatus');
  const btnCancel = q('#btnCancel');
  const btnApply = q('#btnApply');
  const btnClear = q('#btnClear');
  const filterDate = q('#filterDate');
  const filterSearch = q('#filterSearch');
  const filterStatus = q('#filterStatus');

  function safeGetClientName(x){
    // x may be string, object with name, object with client/name, or contain cliente_id subdoc
    if (!x && x !== 0) return '';
    if (typeof x === 'string') return x;
    if (typeof x === 'number') return String(x);
    if (x.name) return x.name;
    if (x.nome) return x.nome;
    if (x.client) return safeGetClientName(x.client);
    if (x.cliente) return safeGetClientName(x.cliente);
    if (x.cliente_id && typeof x.cliente_id === 'object') return safeGetClientName(x.cliente_id);
    return '';
  }

  function safeGetValue(v){
    if (v === undefined || v === null) return 0;
    if (typeof v === 'number') return v;
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  function formatDateField(item){
    // try many possible date fields
    const d = item.data || item.createdAt || item.criado_em || item.created_at || item.created;
    if (!d) return null;
    try { return new Date(d); } catch(e){ return null; }
  }

  function openModal(data){
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    if (data){
      evId.value = data._id || data.id || '';
      const d = formatDateField(data);
      evDate.value = d ? new Date(d).toISOString().substr(0,10) : (data.date || '');
      evTime.value = data.time || data.hora || '';
      evClient.value = safeGetClientName(data.client || data.cliente || data.cliente_id) || '';
      evTech.value = data.tech || data.tecnico || '';
      evDesc.value = data.desc || data.descricao || '';
      evValue.value = safeGetValue(data.value || data.valor || data.total || 0);
      evStatus.value = data.status || data.estado || 'pending';
      q('#modalTitle').innerText = 'Editar compromisso';
    } else {
      form.reset();
      evId.value = '';
      q('#modalTitle').innerText = 'Novo compromisso';
    }
  }
  function closeModal(){ modal.style.display = 'none'; modal.classList.add('hidden'); }

  async function api(url, opts){
    const res = await fetch(url, Object.assign({ credentials:'same-origin' }, opts));
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }

  async function loadEvents(){
    try {
      const date = filterDate.value;
      // request backend (backend may support date param or not)
      const url = date ? `/api/agenda?date=${encodeURIComponent(date)}` : '/api/agenda';
      const rows = await api(url);

      // Apply client-side filters to be robust if backend doesn't support search/status
      const search = (filterSearch.value || '').trim().toLowerCase();
      const statusFilter = (filterStatus.value || '').trim();

      const filtered = (rows||[]).filter(r => {
        // status filter
        if (statusFilter && String((r.status || r.estado || '')).toLowerCase() !== statusFilter.toLowerCase()) return false;
        // search filter (client name or description or tech)
        if (!search) return true;
        const clientName = safeGetClientName(r.client || r.cliente || r.cliente_id).toLowerCase();
        const desc = String(r.desc || r.descricao || r.description || '').toLowerCase();
        const tech = String(r.tech || r.tecnico || '').toLowerCase();
        return clientName.includes(search) || desc.includes(search) || tech.includes(search);
      });

      eventsTable.innerHTML = (filtered.map(r => {
        const d = formatDateField(r);
        const dateText = d ? d.toLocaleString() + (r.time ? ' ' + r.time : '') : (r.data ? String(r.data) : '-');
        const client = safeGetClientName(r.client || r.cliente || r.cliente_id);
        const value = safeGetValue(r.value || r.valor || r.total);
        const status = r.status || r.estado || 'pending';
        const color = status === 'done' ? '#2f9b3a' : (status === 'cancel' ? '#b93a3a' : '#f6ad55');
        return `<tr>
          <td>${dateText}</td>
          <td>${client||''}</td>
          <td>${value ? Number(value).toFixed(2) : '-'}</td>
          <td><span class="px-2 py-1 rounded text-sm" style="background:${color}; color:#050505">${status}</span></td>
          <td style="text-align:right">
            <button data-id="${r._id || r.id}" data-action="edit" class="px-2 py-1 rounded bg-blue-600">Editar</button>
            <button data-id="${r._id || r.id}" data-action="delete" class="px-2 py-1 rounded bg-gray-700">Excluir</button>
          </td>
        </tr>`;
      }).join('')) || '<tr><td colspan="5">Nenhum evento</td></tr>';

      cardsCount.innerText = `Eventos: ${filtered.length}`;
      const pending = (filtered.filter(x => (x.status || x.estado || '') === 'pending')).length;
      pendingCount.innerText = `Pendentes: ${pending}`;
      const total = filtered.reduce((s,x) => s + safeGetValue(x.value || x.valor || x.total), 0);
      sumValue.innerText = `Total R$: ${Number(total).toFixed(2)}`;
    } catch (err) {
      console.error(err);
      eventsTable.innerHTML = '<tr><td colspan="5">Erro ao carregar</td></tr>';
    }
  }

  // click handlers (delegation)
  document.body.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (action === 'edit') {
      try {
        const data = await api(`/api/agenda/${id}`);
        openModal(data);
      } catch (e) { console.error(e); alert('Erro ao obter evento'); }
    } else if (action === 'delete') {
      if (!confirm('Excluir evento?')) return;
      try {
        await api(`/api/agenda/${id}`, { method:'DELETE' });
        await loadEvents();
      } catch (e) { console.error(e); alert('Erro ao excluir'); }
    }
  });

  btnNew.addEventListener('click', ()=> openModal(null));
  btnCancel.addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      date: evDate.value,
      time: evTime.value,
      client: evClient.value,
      tech: evTech.value,
      desc: evDesc.value,
      value: Number(evValue.value) || 0,
      status: evStatus.value
    };
    try {
      if (evId.value) {
        await api(`/api/agenda/${evId.value}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      } else {
        await api('/api/agenda', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      }
      closeModal();
      await loadEvents();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar');
    }
  });

  btnApply.addEventListener('click', loadEvents);
  btnClear.addEventListener('click', () => { filterDate.value=''; filterSearch.value=''; filterStatus.value=''; loadEvents(); });

  // initial load
  await loadEvents();
})();
