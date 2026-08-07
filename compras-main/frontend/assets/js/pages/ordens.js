const PageOrdens = {
  filtros: { busca: '', status: '', prioridade: '', tipo: '', pagina: 1 },

  async render() {
    document.getElementById('topbar-actions').innerHTML =
      '<button class="btn btn-secondary btn-sm" onclick="PageOrdens.exportarExcel()">⬇ Excel</button>' +
      '<button class="btn btn-secondary btn-sm" onclick="App.navigate(\'kanban\')">⊟ Kanban</button>' +
      '<button class="btn btn-secondary btn-sm" onclick="PageOrdens.abrirImportPDF()">📄 Importar PDF</button>' +
      '<button class="btn btn-orange" onclick="PageOrdens.abrirModal()">+ Nova O.S.</button>';

    document.getElementById('content').innerHTML = `
      <div class="card">
        <div class="filters-bar">
          <input type="text" class="form-input search-input" placeholder="Buscar número, cliente ou equipamento…"
            id="busca-os" value="${this.filtros.busca}" oninput="PageOrdens.filtrar()">
          <select class="form-select filter-select" id="filtro-tipo" onchange="PageOrdens.filtrar()">
            <option value="">Todos os tipos</option>
            <option value="OS">Ordem de Serviço</option>
            <option value="Pedido">Pedido de Peças</option>
          </select>
          <select class="form-select filter-select" id="filtro-status" onchange="PageOrdens.filtrar()">
            <option value="">Todos os status</option>
            <option>Aberta</option><option>Aguardando peças</option>
            <option>Peças separadas</option><option>Concluída</option>
          </select>
          <select class="form-select filter-select" id="filtro-prioridade" onchange="PageOrdens.filtrar()">
            <option value="">Todas prioridades</option>
            <option>Alta</option><option>Média</option><option>Baixa</option>
          </select>
        </div>
        <div id="tabela-os"></div>
      </div>
      ${this.htmlModal()}
      ${this.htmlModalImportPDF()}`;

    this.restaurarFiltros();
    await this.carregar();
  },

  restaurarFiltros() {
    if (this.filtros.status)    document.getElementById('filtro-status').value    = this.filtros.status;
    if (this.filtros.prioridade)document.getElementById('filtro-prioridade').value= this.filtros.prioridade;
    if (this.filtros.tipo)      document.getElementById('filtro-tipo').value      = this.filtros.tipo;
  },

  filtrar() {
    this.filtros.busca      = document.getElementById('busca-os').value;
    this.filtros.status     = document.getElementById('filtro-status').value;
    this.filtros.prioridade = document.getElementById('filtro-prioridade').value;
    this.filtros.tipo       = document.getElementById('filtro-tipo').value;
    this.filtros.pagina = 1;
    clearTimeout(this._debounce);
    this._debounce = setTimeout(() => this.carregar(), 300);
  },

  async carregar() {
    const { busca, status, prioridade, tipo, pagina } = this.filtros;
    const params = new URLSearchParams({ pagina, limite: 25 });
    if (busca)      params.set('busca', busca);
    if (status)     params.set('status', status);
    if (prioridade) params.set('prioridade', prioridade);
    if (tipo)       params.set('tipo', tipo);
    try {
      const data = await Api.get(`/os?${params}`);
      document.getElementById('tabela-os').innerHTML = this.renderTabela(data);
    } catch(e) {
      document.getElementById('tabela-os').innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
    }
  },

  _colsOS: [
    { key:'numero_os',              label:'Número',    tipo:'str'  },
    { key:'cliente',                label:'Cliente',   tipo:'str'  },
    { key:'equipamento',            label:'Equipamento',tipo:'str' },
    { key:'data_abertura',          label:'Abertura',  tipo:'date' },
    { key:'data_conclusao_estimada',label:'Previsão',  tipo:'date' },
    { key:'status',                 label:'Status',    tipo:'str'  },
    { key:'prioridade',             label:'Prioridade',tipo:'str'  },
    { key:'total_pecas',            label:'Peças',     tipo:'num'  },
  ],

  _colsOS: [
    { key:'numero_os',               label:'Número',     tipo:'str'  },
    { key:'cliente',                 label:'Cliente',    tipo:'str'  },
    { key:'equipamento',             label:'Equipamento',tipo:'str'  },
    { key:'data_abertura',           label:'Abertura',   tipo:'date' },
    { key:'data_conclusao_estimada', label:'Previsão',   tipo:'date' },
    { key:'status',                  label:'Status',     tipo:'str'  },
    { key:'prioridade',              label:'Prioridade', tipo:'str'  },
    { key:'total_pecas',             label:'Peças',      tipo:'num'  },
  ],

  renderTabela(data) {
    if (!data.registros.length) return '<div class="empty-state"><p>Nenhuma O.S. encontrada</p></div>';
    TableSort.registrar('os-table', () => { this._lastData = data; this.renderTabelaInPlace(data); });
    return this.renderTabelaInPlace(data);
  },

  _selecionados: new Set(),

  renderTabelaInPlace(data) {
    const { headers, dadosOrdenados } = TableSort.init('os-table', this._colsOS, data.registros, null, null);
    const rows = dadosOrdenados.map(os =>
      '<tr onclick="App.navigate(\'detalhe-os\',{id:' + os.id + '})" style="cursor:pointer">' +
      '<td onclick="event.stopPropagation()" style="width:36px;text-align:center">' +
      '<input type="checkbox" class="os-checkbox" data-id="' + os.id + '" ' + (this._selecionados.has(os.id)?'checked':'') + ' onchange="PageOrdens.toggleSelecao(' + os.id + ',this.checked)" style="width:16px;height:16px;cursor:pointer"></td>' +
      '<td><strong>' + os.numero_os + '</strong> <span class="badge ' + (os.tipo==='Pedido'?'badge-pedido':'badge-separadas') + '" style="font-size:9px">' + (os.tipo||'OS') + '</span></td>' +
      '<td>' + os.cliente + '</td>' +
      '<td class="text-muted" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + os.equipamento + '</td>' +
      '<td>' + Fmt.data(os.data_abertura) + '</td>' +
      '<td>' + (os.data_conclusao_estimada ? Fmt.semaforoPrazo(os.data_conclusao_estimada) : '<span class="text-muted">—</span>') + '</td>' +
      '<td>' + Fmt.statusOS(os.status) + '</td>' +
      '<td>' + Fmt.prioridade(os.prioridade) + '</td>' +
      '<td><div style="display:flex;align-items:center;gap:6px"><div class="progress-bar" style="width:44px"><div class="progress-fill ' + (os.total_pecas>0&&os.pecas_entregues===os.total_pecas?'success':'') + '" style="width:' + (os.total_pecas>0?Math.round(os.pecas_entregues/os.total_pecas*100):0) + '%"></div></div><span class="text-sm text-muted">' + os.pecas_entregues + '/' + os.total_pecas + '</span></div></td>' +
      '</tr>'
    ).join('');
    const totalPags = Math.ceil(data.total / data.limite);
    const pag = totalPags > 1
      ? '<div class="pagination"><span class="page-info">' + data.total + ' registros</span>' +
        Array.from({length:totalPags},(_,i)=>i+1).map(p=>'<button class="page-btn ' + (p===data.pagina?'active':'') + '" onclick="PageOrdens.irPagina(' + p + ')">' + p + '</button>').join('') + '</div>'
      : '<div class="page-info" style="text-align:right;padding-top:8px">' + data.total + ' registros</div>';

    // Header com checkbox selecionar todos
    const thCheckbox = '<th style="width:36px;text-align:center"><input type="checkbox" id="check-todos" onchange="PageOrdens.selecionarTodos(this.checked)" style="width:16px;height:16px;cursor:pointer" title="Selecionar todos"></th>';
    const html = '<div class="table-wrap"><table><thead><tr>' + thCheckbox + headers + '</tr></thead><tbody>' + rows + '</tbody></table></div>' + pag;
    const el = document.getElementById('tabela-os');
    if (el) el.innerHTML = html;

    // Barra de ações em lote
    this.atualizarBarraLote();
    return html;
  },

  toggleSelecao(id, checked) {
    if (checked) this._selecionados.add(id);
    else this._selecionados.delete(id);
    this.atualizarBarraLote();
  },

  selecionarTodos(checked) {
    document.querySelectorAll('.os-checkbox').forEach(cb => {
      const id = parseInt(cb.dataset.id);
      cb.checked = checked;
      if (checked) this._selecionados.add(id);
      else this._selecionados.delete(id);
    });
    this.atualizarBarraLote();
  },

  atualizarBarraLote() {
    let barra = document.getElementById('barra-lote');
    if (!barra) {
      barra = document.createElement('div');
      barra.id = 'barra-lote';
      const tabela = document.getElementById('tabela-os');
      if (tabela) tabela.parentNode.insertBefore(barra, tabela);
    }
    const n = this._selecionados.size;
    if (n === 0) {
      barra.innerHTML = '';
      return;
    }
    barra.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:var(--radius-lg);margin-bottom:10px">' +
      '<span style="font-size:13px;font-weight:600;color:#dc2626">' + n + ' O.S. selecionada(s)</span>' +
      '<button class="btn btn-danger btn-sm" onclick="PageOrdens.excluirLote()">🗑 Excluir selecionadas</button>' +
      '<button class="btn btn-secondary btn-sm" onclick="PageOrdens.limparSelecao()">✕ Cancelar seleção</button>' +
      '</div>';
  },

  limparSelecao() {
    this._selecionados.clear();
    document.querySelectorAll('.os-checkbox').forEach(cb => cb.checked = false);
    const chkTodos = document.getElementById('check-todos');
    if (chkTodos) chkTodos.checked = false;
    this.atualizarBarraLote();
  },

  async excluirLote() {
    const ids = [...this._selecionados];
    if (!ids.length) return;
    if (!App.confirm('Excluir ' + ids.length + ' O.S. selecionada(s)? Esta ação não pode ser desfeita.')) return;
    let erros = 0;
    for (const id of ids) {
      try { await Api.delete('/os/' + id); }
      catch(e) { erros++; }
    }
    this._selecionados.clear();
    App.toast(
      erros === 0
        ? ids.length + ' O.S. excluída(s) com sucesso!'
        : (ids.length - erros) + ' excluída(s), ' + erros + ' com erro.',
      erros === 0 ? 'success' : 'error'
    );
    this.carregar();
  },

  irPagina(p) { this.filtros.pagina = p; this.carregar(); },

  async exportarExcel() {
    try {
      const params = new URLSearchParams({ pagina: 1, limite: 9999 });
      if (this.filtros.busca)      params.set('busca', this.filtros.busca);
      if (this.filtros.status)     params.set('status', this.filtros.status);
      if (this.filtros.prioridade) params.set('prioridade', this.filtros.prioridade);
      if (this.filtros.tipo)       params.set('tipo', this.filtros.tipo);
      const data = await Api.get('/os?' + params);
      const colunas = [
        { key:'numero_os',               label:'Número'       },
        { key:'tipo',                    label:'Tipo'         },
        { key:'cliente',                 label:'Cliente'      },
        { key:'equipamento',             label:'Equipamento'  },
        { key:'status',                  label:'Status'       },
        { key:'prioridade',              label:'Prioridade'   },
        { key:'data_abertura',           label:'Abertura'     },
        { key:'data_conclusao_estimada', label:'Previsão'     },
        { key:'total_pecas',             label:'Total Peças'  },
        { key:'pecas_entregues',         label:'Entregues'    },
      ];
      ExportExcel.exportar(data.registros, colunas, 'ordens-servico');
    } catch(e) { App.toast(e.message, 'error'); }
  },

  abrirModal(os) {
    this._editandoId = os?.id || null;
    document.getElementById('modal-os-titulo').textContent = os ? 'Editar O.S.' : 'Nova O.S.';
    if (os) {
      document.getElementById('os-numero').value      = os.numero_os || '';
      document.getElementById('os-cliente').value     = os.cliente || '';
      document.getElementById('os-equipamento').value = os.equipamento || '';
      document.getElementById('os-data-abertura').value  = os.data_abertura?.split('T')[0] || '';
      document.getElementById('os-data-conclusao').value = os.data_conclusao_estimada?.split('T')[0] || '';
      document.getElementById('os-status').value      = os.status || 'Aberta';
      document.getElementById('os-prioridade').value  = os.prioridade || 'Média';
      document.getElementById('os-tipo').value        = os.tipo || 'OS';
      document.getElementById('os-transporte').value  = os.transporte || '';
      document.getElementById('os-observacoes').value = os.observacoes || '';
    } else {
      document.getElementById('form-os').reset();
      document.getElementById('os-data-abertura').value = new Date().toISOString().split('T')[0];
    }
    document.getElementById('modal-os').classList.remove('hidden');
  },

  fecharModal() { document.getElementById('modal-os').classList.add('hidden'); },

  async salvar() {
    const payload = {
      numero_os:               document.getElementById('os-numero').value.trim(),
      cliente:                 document.getElementById('os-cliente').value.trim(),
      equipamento:             document.getElementById('os-equipamento').value.trim(),
      data_abertura:           document.getElementById('os-data-abertura').value,
      data_conclusao_estimada: document.getElementById('os-data-conclusao').value || null,
      status:                  document.getElementById('os-status').value,
      prioridade:              document.getElementById('os-prioridade').value,
      tipo:                    document.getElementById('os-tipo').value,
      transporte:              document.getElementById('os-transporte').value || null,
      observacoes:             document.getElementById('os-observacoes').value || null
    };
    if (!payload.numero_os || !payload.cliente || !payload.equipamento || !payload.data_abertura) {
      App.toast('Preencha os campos obrigatórios', 'error'); return;
    }
    try {
      if (this._editandoId) await Api.put(`/os/${this._editandoId}`, payload);
      else await Api.post('/os', payload);
      App.toast(this._editandoId ? 'O.S. atualizada!' : 'O.S. criada!', 'success');
      this.fecharModal(); await this.carregar();
    } catch(e) { App.toast(e.message, 'error'); }
  },

  // Modal rápido de importação PDF na aba Ordens
  abrirImportPDF() {
    document.getElementById('modal-import-pdf').classList.remove('hidden');
    document.getElementById('import-pdf-lista').innerHTML = '';
    document.getElementById('import-pdf-resultado').innerHTML = '';
  },
  fecharImportPDF() {
    document.getElementById('modal-import-pdf').classList.add('hidden');
    document.getElementById('import-pdf-resultado').innerHTML = '';
    document.getElementById('import-pdf-lista').innerHTML = '';
    document.getElementById('import-pdf-status').textContent = '';
    document.getElementById('import-pdf-files').value = '';
  },

  mostrarArquivosSelecionados(files) {
    const lista = document.getElementById('import-pdf-lista');
    if (!files.length) { lista.innerHTML = ''; return; }
    lista.innerHTML =
      '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-lg);padding:10px;margin-bottom:4px">' +
      '<div style="font-size:11px;font-weight:600;color:var(--text-3);margin-bottom:6px">' +
      '<span style="background:var(--brand2);color:#fff;border-radius:20px;padding:1px 7px;margin-right:5px">' + files.length + '</span>' +
      'arquivo(s) selecionado(s)</div>' +
      '<div style="display:flex;flex-direction:column;gap:3px;max-height:150px;overflow-y:auto">' +
      Array.from(files).map(f => {
        const kb = Math.round(f.size / 1024);
        const tam = kb > 1024 ? (kb/1024).toFixed(1) + ' MB' : kb + ' KB';
        return '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--surface);border-radius:var(--radius);font-size:11px">' +
          '<span>📄</span>' +
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500">' + f.name + '</span>' +
          '<span style="color:var(--text-4);flex-shrink:0">' + tam + '</span>' +
          '</div>';
      }).join('') +
      '</div></div>';
  },

  async importarPDFs() {
    const input = document.getElementById('import-pdf-files');
    if (!input.files.length) { App.toast('Selecione os PDFs', 'error'); return; }
    const btn = document.getElementById('btn-import-pdf');
    btn.disabled = true; btn.textContent = 'Importando…';
    document.getElementById('import-pdf-status').textContent = `Processando ${input.files.length} arquivo(s)…`;
    const fd = new FormData();
    Array.from(input.files).forEach(f => fd.append('arquivos', f));
    try {
      const resp = await fetch('/api/importar-pdf', {
        method: 'POST', headers: { 'Authorization': `Bearer ${Api.token}` }, body: fd
      });
      const data = await resp.json();
      const ok   = data.resultados.filter(r => r.sucesso);
      const err  = data.resultados.filter(r => !r.sucesso);
      const totalP = ok.reduce((s,r) => s + r.pecas_importadas, 0);
      document.getElementById('import-pdf-resultado').innerHTML = `
        ${ok.length ? `<div class="alert alert-success">✅ ${ok.length} O.S. importada(s) — ${totalP} peças</div>` : ''}
        ${err.length ? `<div class="alert alert-danger">❌ ${err.map(r=>r.arquivo+': '+r.erro).join('<br>')}</div>` : ''}`;
      if (ok.length) {
        // Pede o tipo logo após importar
        document.getElementById('import-pdf-tipo').classList.remove('hidden');
        document.getElementById('import-pdf-os-ids').value = JSON.stringify(ok.map(r => r.numero_os));
      }
      await this.carregar();
    } catch(e) {
      document.getElementById('import-pdf-resultado').innerHTML = `<div class="alert alert-danger">❌ ${e.message}</div>`;
    }
    btn.disabled = false; btn.textContent = 'Importar';
    document.getElementById('import-pdf-status').textContent = '';
  },

  async definirTipoImportados() {
    const tipo = document.getElementById('import-pdf-tipo-select').value;
    const numeros = JSON.parse(document.getElementById('import-pdf-os-ids').value || '[]');
    let atualizados = 0;
    for (const numero of numeros) {
      try {
        // Busca a OS pelo número para pegar o ID real
        const data = await Api.get('/os?busca=' + encodeURIComponent(numero) + '&limite=5');
        const os = data.registros?.find(o => o.numero_os === String(numero));
        if (os) { await Api.put('/os/' + os.id, { tipo }); atualizados++; }
      } catch(e) {}
    }
    App.toast('Tipo "' + tipo + '" aplicado a ' + atualizados + ' O.S.', 'success');
    document.getElementById('import-pdf-tipo').classList.add('hidden');
    await this.carregar();
  },

  htmlModalImportPDF() {
    return `
    <div id="modal-import-pdf" class="modal-backdrop hidden">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Importar PDFs do Primam</span>
          <button class="btn-icon" onclick="PageOrdens.fecharImportPDF()">✕</button>
        </div>
        <div class="modal-body">
          <div style="border:2px dashed var(--border);border-radius:var(--radius-lg);padding:20px;text-align:center;margin-bottom:14px;cursor:pointer" onclick="document.getElementById('import-pdf-files').click()">
            <div style="font-size:28px;margin-bottom:6px">📄</div>
            <div style="font-size:12px;font-weight:600;color:var(--text-2)">Clique ou arraste os PDFs aqui</div>
            <div style="font-size:11px;color:var(--text-4);margin-top:3px">Múltiplos arquivos ao mesmo tempo</div>
            <input type="file" id="import-pdf-files" accept=".pdf" multiple style="display:none" onchange="PageOrdens.mostrarArquivosSelecionados(this.files)">
          </div>
          <div id="import-pdf-lista" style="margin-bottom:10px"></div>
          <div id="import-pdf-resultado"></div>
          <div id="import-pdf-tipo" class="hidden" style="background:var(--info-bg);padding:12px;border-radius:var(--radius);margin-top:10px">
            <div style="font-size:12px;font-weight:600;margin-bottom:8px">Qual é o tipo das O.S. importadas?</div>
            <div style="display:flex;gap:8px;align-items:center">
              <select id="import-pdf-tipo-select" class="form-select" style="flex:1">
                <option value="OS">Ordem de Serviço</option>
                <option value="Pedido">Pedido de Peças</option>
              </select>
              <button class="btn btn-primary btn-sm" onclick="PageOrdens.definirTipoImportados()">Aplicar</button>
            </div>
            <input type="hidden" id="import-pdf-os-ids" value="[]">
          </div>
          <span id="import-pdf-status" style="font-size:12px;color:var(--text-3)"></span>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="PageOrdens.fecharImportPDF()">Fechar</button>
          <button class="btn btn-orange" id="btn-import-pdf" onclick="PageOrdens.importarPDFs()">Importar</button>
        </div>
      </div>
    </div>`;
  },

  htmlModal() {
    return `
    <div id="modal-os" class="modal-backdrop hidden">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title" id="modal-os-titulo">Nova O.S.</span>
          <button class="btn-icon" onclick="PageOrdens.fecharModal()">✕</button>
        </div>
        <div class="modal-body">
          <form id="form-os" onsubmit="return false">
            <div class="form-grid mb-12">
              <div class="form-group"><label class="form-label required">Número da O.S.</label><input id="os-numero" class="form-input" placeholder="OS-0001"></div>
              <div class="form-group"><label class="form-label required">Cliente</label><input id="os-cliente" class="form-input"></div>
              <div class="form-group form-full"><label class="form-label required">Equipamento</label><input id="os-equipamento" class="form-input"></div>
              <div class="form-group"><label class="form-label required">Data de abertura</label><input id="os-data-abertura" class="form-input" type="date"></div>
              <div class="form-group"><label class="form-label">Previsão de conclusão</label><input id="os-data-conclusao" class="form-input" type="date"></div>
              <div class="form-group"><label class="form-label">Tipo</label>
                <select id="os-tipo" class="form-select"><option value="OS">Ordem de Serviço</option><option value="Pedido">Pedido de Peças</option></select>
              </div>
              <div class="form-group"><label class="form-label">Status</label>
                <select id="os-status" class="form-select"><option>Aberta</option><option>Aguardando peças</option><option>Peças separadas</option><option>Concluída</option></select>
              </div>
              <div class="form-group"><label class="form-label">Prioridade</label>
                <select id="os-prioridade" class="form-select"><option>Alta</option><option>Média</option><option>Baixa</option></select>
              </div>
              <div class="form-group"><label class="form-label">Transporte</label><input id="os-transporte" class="form-input" placeholder="Ex: RODONAVES, SEDEX..."></div>
              <div class="form-group form-full"><label class="form-label">Observações</label><textarea id="os-observacoes" class="form-textarea"></textarea></div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="PageOrdens.fecharModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="PageOrdens.salvar()">Salvar</button>
        </div>
      </div>
    </div>`;
  }
};
