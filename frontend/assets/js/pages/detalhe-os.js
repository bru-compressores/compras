const PageDetalheOS = {
  os: null, fornecedores: [], editando: false, cfg: {},
  _transportesUsados: [],

  async render(params) {
    if (!params?.id) { App.navigate('ordens'); return; }
    this._osId = params.id;
    document.getElementById('content').innerHTML = '<div class="empty-state"><p>Carregando…</p></div>';
    try {
      const [os, fornecedores, cfg] = await Promise.all([
        Api.get('/os/' + params.id),
        Api.get('/fornecedores'),
        Api.get('/configuracoes').catch(() => ({}))
      ]);
      this.os = os; this.fornecedores = fornecedores; this.cfg = cfg;
      // Coleta transportes já usados nesta OS para sugestões
      this._transportesUsados = [...new Set(
        os.pecas.map(p => p.transporte).filter(Boolean)
      )];
      this.renderPagina();
    } catch(e) {
      document.getElementById('content').innerHTML = '<div class="alert alert-danger">' + e.message + '</div>';
    }
  },

  markupSinaleiro(venda, fechado) {
    if (!venda || !fechado || fechado === 0) return null;
    const mk = venda / fechado;
    const verde   = parseFloat(this.cfg.markup_verde   || 2.2);
    const laranja = parseFloat(this.cfg.markup_laranja || 2.0);
    if (mk >= verde)        return { mk: mk.toFixed(2)+'x', cor:'#15803d', bg:'#dcfce7', label:'🟢' };
    if (mk >= laranja)      return { mk: mk.toFixed(2)+'x', cor:'#d97706', bg:'#fef3c7', label:'🟡' };
    return                         { mk: mk.toFixed(2)+'x', cor:'#dc2626', bg:'#fee2e2', label:'🔴' };
  },

  // Badge colorido para status de entrega
  badgeStatus(s) {
    const map = {
      'Pendente':         { bg:'#f1f5f9', cor:'#64748b', dot:'#94a3b8' },
      'Pedido realizado': { bg:'#eff6ff', cor:'#1a56db', dot:'#1a56db' },
      'Em trânsito':      { bg:'#fffbeb', cor:'#d97706', dot:'#d97706' },
      'Entregue':         { bg:'#f0fdf4', cor:'#16a34a', dot:'#16a34a' },
      'Cancelado':        { bg:'#fef2f2', cor:'#dc2626', dot:'#dc2626' },
    };
    const c = map[s] || map['Pendente'];
    return '<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:600;background:' + c.bg + ';color:' + c.cor + '">' +
      '<span style="width:7px;height:7px;border-radius:50%;background:' + c.dot + ';flex-shrink:0"></span>' + s + '</span>';
  },

  renderPagina() {
    const os = this.os;
    const totalPecas = os.pecas.length;
    const entregues  = os.pecas.filter(p => p.status_entrega === 'Entregue').length;
    const valorVenda  = os.pecas.reduce((s,p) => s + (p.preco_unitario||0)*p.quantidade, 0);
    const valorCotado = os.pecas.reduce((s,p) => s + (p.preco_cotado||0)*p.quantidade, 0);
    const valorFech   = os.pecas.reduce((s,p) => s + (p.preco_fechado||0)*p.quantidade, 0);
    const mkGlobal    = this.markupSinaleiro(valorVenda, valorFech);

    document.getElementById('topbar-actions').innerHTML =
      '<button class="btn btn-secondary btn-sm" onclick="App.voltar()">← Voltar</button>' +
      '<button class="btn btn-secondary btn-sm" onclick="PageDetalheOS.exportarExcel()">⬇ Excel</button>' +
      '<button class="btn btn-secondary btn-sm" onclick="PageDetalheOS.imprimirPDF()" title="Gerar PDF profissional">🖨 PDF</button>' +
      '<button class="btn btn-secondary btn-sm" onclick="PageDetalheOS.duplicar()" title="Duplicar esta O.S.">⧉ Duplicar</button>' +
      (this.editando
        ? '<button class="btn btn-secondary btn-sm" onclick="PageDetalheOS.cancelarEdicao()">Cancelar</button>' +
          '<button class="btn btn-orange btn-sm" onclick="PageDetalheOS.salvarEdicao()">💾 Salvar</button>'
        : '<button class="btn btn-primary btn-sm" onclick="PageDetalheOS.ativarEdicao()">✏ Editar</button>' +
          '<button class="btn btn-danger btn-sm" onclick="PageDetalheOS.excluirOS()">🗑 Excluir</button>');

    document.getElementById('content').innerHTML =
      '<div class="card mb-14">' + (this.editando ? this.renderFormEdicao() : this.renderCabecalho()) + '</div>' +

      '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:14px">' +
      '<div class="kpi-card info"><div class="kpi-label">Total de peças</div><div class="kpi-value">' + totalPecas + '</div><div class="kpi-sub">' + entregues + ' entregues</div></div>' +
      '<div class="kpi-card warning"><div class="kpi-label">Preço de Venda</div><div class="kpi-value" style="font-size:16px">' + Fmt.moeda(valorVenda) + '</div><div class="kpi-sub">valor ERP</div></div>' +
      '<div class="kpi-card"><div class="kpi-label">Melhor Cotação</div><div class="kpi-value" style="font-size:16px">' + (valorCotado > 0 ? Fmt.moeda(valorCotado) : '<span style="color:var(--text-4);font-size:13px">—</span>') + '</div><div class="kpi-sub">preço cotado</div></div>' +
      '<div class="kpi-card ' + (valorFech > 0 ? 'success' : '') + '"><div class="kpi-label">Valor Fechado</div><div class="kpi-value" style="font-size:16px">' + (valorFech > 0 ? Fmt.moeda(valorFech) : '<span style="color:var(--text-4);font-size:13px">—</span>') + '</div><div class="kpi-sub">negociado</div></div>' +
      '<div class="kpi-card" style="' + (mkGlobal ? 'background:'+mkGlobal.bg+';border-top-color:'+mkGlobal.cor : '') + '">' +
      '<div class="kpi-label">Markup Geral</div>' +
      '<div class="kpi-value" style="font-size:20px;color:' + (mkGlobal ? mkGlobal.cor : 'var(--text-4)') + '">' + (mkGlobal ? mkGlobal.label+' '+mkGlobal.mk : '—') + '</div>' +
      '<div class="kpi-sub">' + (mkGlobal ? 'venda/fechado' : 'sem valor fechado') + '</div></div>' +
      '</div>' +

      '<div class="card mb-14"><div class="card-header"><div class="card-title">Peças</div>' +
      '<button class="btn btn-orange btn-sm" onclick="PageDetalheOS.abrirModalPeca()">+ Adicionar peça</button></div>' +
      this.renderTabelaPecas() + '</div>' +

      '<div class="card mb-14"><div class="card-header"><div class="card-title">Histórico de status</div></div>' +
      this.renderTimeline() + '</div>' +

      // Comentários por peça
      '<div class="card"><div class="card-header"><div class="card-title">💬 Comentários por peça</div>' +
      '<div class="card-subtitle">Notas rápidas sobre peças específicas</div></div>' +
      '<div id="comentarios-section">' + this.renderComentariosSelector() + '</div></div>' +

      this.htmlModalPeca();
  },

  renderCabecalho() {
    const os = this.os;
    return '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">' +
      '<div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
      '<span style="font-size:18px;font-weight:700">' + os.numero_os + '</span>' +
      '<span class="badge ' + (os.tipo==='Pedido'?'badge-pedido':'badge-separadas') + '" style="font-size:10px">' + (os.tipo||'OS') + '</span>' +
      Fmt.prioridade(os.prioridade) + Fmt.statusOS(os.status) + '</div>' +
      '<div style="font-size:13px;color:var(--text-3);margin-top:3px">' + os.cliente + '</div></div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-top:14px">' +
      '<div><div class="detail-lbl">Equipamento</div><div class="detail-val">' + os.equipamento + '</div></div>' +
      '<div><div class="detail-lbl">Abertura</div><div class="detail-val">' + Fmt.data(os.data_abertura) + '</div></div>' +
      '<div><div class="detail-lbl">Previsão</div><div class="detail-val">' + Fmt.data(os.data_conclusao_estimada) + '</div></div>' +
      '<div><div class="detail-lbl">Transporte (geral)</div><div class="detail-val">' + (os.transporte||'—') + '</div></div>' +
      (os.observacoes ? '<div style="grid-column:1/-1"><div class="detail-lbl">Observações</div><div class="detail-val">' + os.observacoes + '</div></div>' : '') +
      '</div>';
  },

  renderFormEdicao() {
    const os = this.os;
    const sel = (v, ops) => ops.map(o => '<option' + (o===v?' selected':'') + '>' + o + '</option>').join('');
    return '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">' +
      '<div class="form-group"><label class="form-label required">Número</label><input id="e-numero" class="form-input" value="' + os.numero_os + '"></div>' +
      '<div class="form-group" style="grid-column:span 2"><label class="form-label required">Cliente</label><input id="e-cliente" class="form-input" value="' + os.cliente + '"></div>' +
      '<div class="form-group" style="grid-column:1/-1"><label class="form-label">Equipamento</label><input id="e-equipamento" class="form-input" value="' + os.equipamento + '"></div>' +
      '<div class="form-group"><label class="form-label">Tipo</label><select id="e-tipo" class="form-select"><option value="OS"' + ((os.tipo||'OS')==='OS'?' selected':'') + '>Ordem de Serviço</option><option value="Pedido"' + (os.tipo==='Pedido'?' selected':'') + '>Pedido de Peças</option></select></div>' +
      '<div class="form-group"><label class="form-label">Status</label><select id="e-status" class="form-select">' + sel(os.status,['Aberta','Aguardando peças','Peças separadas','Concluída']) + '</select></div>' +
      '<div class="form-group"><label class="form-label">Prioridade</label><select id="e-prioridade" class="form-select">' + sel(os.prioridade,['Alta','Média','Baixa']) + '</select></div>' +
      '<div class="form-group"><label class="form-label">Abertura</label><input id="e-abertura" class="form-input" type="date" value="' + (os.data_abertura?.split('T')[0]||'') + '"></div>' +
      '<div class="form-group"><label class="form-label">Previsão</label><input id="e-conclusao" class="form-input" type="date" value="' + (os.data_conclusao_estimada?.split('T')[0]||'') + '"></div>' +
      '<div class="form-group"><label class="form-label">Transporte geral</label><input id="e-transporte" class="form-input" value="' + (os.transporte||'') + '"></div>' +
      '<div class="form-group" style="grid-column:1/-1"><label class="form-label">Observações</label><textarea id="e-observacoes" class="form-textarea">' + (os.observacoes||'') + '</textarea></div>' +
      '</div>';
  },

  ativarEdicao()  { this.editando = true;  this.renderPagina(); },
  cancelarEdicao(){ this.editando = false; this.renderPagina(); },

  async salvarEdicao() {
    const payload = {
      numero_os: document.getElementById('e-numero').value.trim(),
      cliente: document.getElementById('e-cliente').value.trim(),
      equipamento: document.getElementById('e-equipamento').value.trim(),
      tipo: document.getElementById('e-tipo').value,
      status: document.getElementById('e-status').value,
      prioridade: document.getElementById('e-prioridade').value,
      data_abertura: document.getElementById('e-abertura').value,
      data_conclusao_estimada: document.getElementById('e-conclusao').value || null,
      transporte: document.getElementById('e-transporte').value || null,
      observacoes: document.getElementById('e-observacoes').value || null
    };
    try {
      await Api.put('/os/' + this.os.id, payload);
      App.toast('O.S. salva!', 'success');
      this.editando = false;
      this.os = await Api.get('/os/' + this.os.id);
      this.renderPagina();
    } catch(e) { App.toast(e.message, 'error'); }
  },

  _colsPecas: [
    { key:'codigo',               label:'Código',        tipo:'str'  },
    { key:'descricao',            label:'Descrição',     tipo:'str'  },
    { key:'quantidade',           label:'Qtd',           tipo:'num'  },
    { key:'preco_unitario',       label:'Venda',         tipo:'num'  },
    { key:'preco_cotado',         label:'Cotado',        tipo:'num'  },
    { key:'preco_fechado',        label:'Fechado',       tipo:'num'  },
    { key:'_markup',              label:'Markup',        tipo:'num'  },
    { key:'fornecedor_nome',      label:'Fornecedor',    tipo:'str'  },
    { key:'status_entrega',       label:'Status',        tipo:'str'  },
    { key:'transporte',           label:'Transporte',    tipo:'str'  },
    { key:'data_entrega_prevista',label:'Prev. Entrega', tipo:'date' },
    { key:'numero_rastreio',      label:'Rastreio',      tipo:'str'  },
    { key:'observacoes',          label:'Observações',   tipo:'str'  },
  ],

  renderTabelaPecas() {
    if (!this.os.pecas.length) return '<div class="empty-state"><p>Nenhuma peça. Clique em "+ Adicionar peça".</p></div>';

    // Adiciona campo _markup calculado para ordenação
    const pecasComMk = this.os.pecas.map(p => ({
      ...p,
      _markup: (p.preco_unitario && p.preco_fechado && p.preco_fechado > 0)
        ? p.preco_unitario / p.preco_fechado : null
    }));

    TableSort.registrar('pecas-table', () => {
      const el = document.querySelector('.card .table-wrap');
      if (el) el.outerHTML = this.renderTabelaPecas();
    });

    const { headers, dadosOrdenados } = TableSort.init('pecas-table', this._colsPecas, pecasComMk, null, null);

    const rows = dadosOrdenados.map(p => {
      const mk = this.markupSinaleiro(p.preco_unitario, p.preco_fechado);
      const mkCell = mk
        ? '<span style="background:' + mk.bg + ';color:' + mk.cor + ';padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">' + mk.label + ' ' + mk.mk + '</span>'
        : '<span class="text-muted">—</span>';

      const bgLinha = p.status_entrega === 'Separado (Almoxarifado)'
        ? ';background:#f0fdf4;border-left:3px solid #16a34a'
        : p.status_entrega === 'Aguardando Triagem'
        ? ';background:#fffbeb;border-left:3px solid #eab308'
        : '';
      return '<tr onclick="PageDetalheOS.editarPecaInline(' + p.id + ')" style="cursor:pointer' + bgLinha + '">' +
        '<td>' + (p.codigo||'<span class="text-muted">—</span>') + '</td>' +
        '<td style="max-width:180px">' + p.descricao + '</td>' +
        '<td style="text-align:center">' + p.quantidade + '</td>' +
        '<td>' + Fmt.moeda(p.preco_unitario) + '</td>' +
        '<td>' + Fmt.moeda(p.preco_cotado) + '</td>' +
        '<td>' + Fmt.moeda(p.preco_fechado) + '</td>' +
        '<td>' + mkCell + '</td>' +
        '<td>' + (p.fornecedor_nome||'<span class="text-muted">—</span>') + '</td>' +
        // Status colorido com dropdown
        '<td onclick="event.stopPropagation()" style="white-space:nowrap">' +
        '<div style="position:relative;display:inline-block">' +
        '<div onclick="PageDetalheOS.toggleStatusMenu(event,' + p.id + ')" style="cursor:pointer">' +
        this.badgeStatus(p.status_entrega) +
        '<span style="font-size:9px;color:var(--text-4);margin-left:3px">▼</span></div>' +
        '<div id="status-menu-' + p.id + '" style="display:none;position:absolute;top:100%;left:0;z-index:200;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow);min-width:160px;padding:4px 0">' +
        ['Pendente','Pedido realizado','Em trânsito','Entregue','Cancelado'].map(s =>
          '<div onclick="PageDetalheOS.atualizarStatusPeca(' + p.id + ',\'' + s + '\')" style="padding:7px 12px;cursor:pointer;font-size:12px" onmouseover="this.style.background=\'var(--surface-2)\'" onmouseout="this.style.background=\'\'">' +
          this.badgeStatus(s) + '</div>'
        ).join('') +
        '</div></div></td>' +
        // Transportadora
        '<td>' + (p.transporte ? '<span style="font-size:11px;background:var(--surface-2);padding:2px 7px;border-radius:4px">' + p.transporte + '</span>' : '<span class="text-muted">—</span>') + '</td>' +
        // Data prevista
        '<td style="white-space:nowrap">' + (p.data_entrega_prevista ? Fmt.semaforoPrazo(p.data_entrega_prevista) : '<span class="text-muted">—</span>') + '</td>' +
        // Rastreio
        '<td>' + (p.numero_rastreio ? '<code style="font-size:10px">' + p.numero_rastreio + '</code>' : '<span class="text-muted">—</span>') + '</td>' +
        // Observações
        '<td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + (p.observacoes||'') + '">' + (p.observacoes ? '<span style="font-size:11px;color:var(--text-3)">' + p.observacoes + '</span>' : '<span class="text-muted">—</span>') + '</td>' +
        '<td onclick="event.stopPropagation()">' +
        '<button class="btn-icon" title="Excluir" onclick="PageDetalheOS.excluirPeca(' + p.id + ')" style="color:var(--danger);font-size:16px">🗑</button>' +
        '</td></tr>';
    }).join('');

    return '<div class="table-wrap"><table>' +
      '<thead><tr>' + headers + '<th style="width:36px"></th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>';
  },

  toggleStatusMenu(e, id) {
    e.stopPropagation();
    // Fecha todos os outros menus
    document.querySelectorAll('[id^="status-menu-"]').forEach(m => {
      if (m.id !== 'status-menu-' + id) m.style.display = 'none';
    });
    const menu = document.getElementById('status-menu-' + id);
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    // Fecha ao clicar fora
    if (menu.style.display === 'block') {
      setTimeout(() => {
        document.addEventListener('click', function close() {
          menu.style.display = 'none';
          document.removeEventListener('click', close);
        });
      }, 10);
    }
  },

  async atualizarStatusPeca(id, status) {
    try {
      await Api.put('/pecas/' + id, { status_entrega: status });
      App.toast('Status: ' + status, 'success');
      this.os = await Api.get('/os/' + this.os.id);
      this.renderPagina();
    } catch(e) { App.toast(e.message, 'error'); }
  },

  editarPecaInline(id) {
    const p = this.os.pecas.find(x => x.id === id);
    if (p) this.abrirModalPeca(p);
  },

  renderTimeline() {
    if (!this.os.historico?.length) return '<div class="empty-state"><p>Sem histórico</p></div>';
    return '<div class="timeline">' + this.os.historico.map(h =>
      '<div class="timeline-item"><div class="timeline-dot"></div><div class="timeline-content">' +
      '<div class="timeline-label">' + (h.status_anterior ? h.status_anterior+' → ' : '') + '<strong>' + h.status_novo + '</strong></div>' +
      (h.observacao ? '<div style="font-size:12px;color:var(--text-2);margin-top:2px">' + h.observacao + '</div>' : '') +
      '<div class="timeline-meta">' + Fmt.data(h.criado_em) + (h.usuario_nome ? ' · '+h.usuario_nome : '') + '</div>' +
      '</div></div>'
    ).join('') + '</div>';
  },

  abrirModalPeca(peca) {
    this._editandoPecaId = peca?.id || null;
    document.getElementById('modal-peca-titulo').textContent = peca ? 'Editar peça' : 'Adicionar peça';

    // Autocomplete fornecedor
    FornecedorAutocomplete.invalidar();
    document.getElementById('peca-fornecedor-wrap').innerHTML =
      FornecedorAutocomplete.html('peca-forn-input', 'peca-fornecedor',
        peca?.fornecedor_id ? { id: peca.fornecedor_id, nome: peca.fornecedor_nome||'' } : null);

    if (peca) {
      document.getElementById('peca-codigo').value       = peca.codigo||'';
      document.getElementById('peca-descricao').value    = peca.descricao||'';
      document.getElementById('peca-quantidade').value   = peca.quantidade||1;
      document.getElementById('peca-preco-venda').value  = peca.preco_unitario||'';
      document.getElementById('peca-preco-cotado').value = peca.preco_cotado||'';
      document.getElementById('peca-preco-fechado').value= peca.preco_fechado||'';
      document.getElementById('peca-transporte').value   = peca.transporte||'';
      document.getElementById('peca-status').value       = peca.status_entrega||'Pendente';
      document.getElementById('peca-data-prev').value    = peca.data_entrega_prevista?.split('T')[0]||'';
      document.getElementById('peca-rastreio').value     = peca.numero_rastreio||'';
      document.getElementById('peca-obs').value          = peca.observacoes||'';
    } else {
      document.getElementById('form-peca').reset();
      document.getElementById('peca-fornecedor-wrap').innerHTML =
        FornecedorAutocomplete.html('peca-forn-input', 'peca-fornecedor', null);
    }

    // Preenche datalist com transportes já usados
    const dl = document.getElementById('transportes-list');
    const todos = [...new Set([
      ...this._transportesUsados,
      'RODONAVES','SEDEX','RETIRADA','ENTREGA NA EMPRESA'
    ])].filter(Boolean);
    dl.innerHTML = todos.map(t => '<option value="' + t + '">').join('');

    document.getElementById('modal-peca').classList.remove('hidden');
  },

  fecharModalPeca() { document.getElementById('modal-peca').classList.add('hidden'); },

  async salvarPeca() {
    const payload = {
      os_id:                this.os.id,
      codigo:               document.getElementById('peca-codigo').value.trim()||null,
      descricao:            document.getElementById('peca-descricao').value.trim(),
      quantidade:           parseInt(document.getElementById('peca-quantidade').value)||1,
      preco_unitario:       parseFloat(document.getElementById('peca-preco-venda').value)||null,
      preco_cotado:         parseFloat(document.getElementById('peca-preco-cotado').value)||null,
      preco_fechado:        parseFloat(document.getElementById('peca-preco-fechado').value)||null,
      fornecedor_id:        parseInt(document.getElementById('peca-fornecedor').value)||null,
      transporte:           document.getElementById('peca-transporte').value.trim()||null,
      status_entrega:       document.getElementById('peca-status').value,
      data_entrega_prevista:document.getElementById('peca-data-prev').value||null,
      numero_rastreio:      document.getElementById('peca-rastreio').value.trim()||null,
      observacoes:          document.getElementById('peca-obs').value.trim()||null
    };
    if (!payload.descricao) { App.toast('Descrição é obrigatória','error'); return; }
    try {
      if (this._editandoPecaId) await Api.put('/pecas/' + this._editandoPecaId, payload);
      else await Api.post('/pecas', payload);
      // Salva transporte para sugestões futuras
      if (payload.transporte && !this._transportesUsados.includes(payload.transporte)) {
        this._transportesUsados.push(payload.transporte);
      }
      App.toast('Peça salva!', 'success');
      this.fecharModalPeca();
      this.os = await Api.get('/os/' + this.os.id);
      this.renderPagina();
    } catch(e) { App.toast(e.message, 'error'); }
  },

  async excluirPeca(id) {
    if (!App.confirm('Excluir esta peça?')) return;
    try {
      await Api.delete('/pecas/' + id);
      App.toast('Peça removida','success');
      this.os = await Api.get('/os/' + this.os.id);
      this.renderPagina();
    } catch(e) { App.toast(e.message,'error'); }
  },

  async excluirOS() {
    if (!App.confirm('Excluir a O.S. ' + this.os.numero_os + '?')) return;
    try { await Api.delete('/os/' + this.os.id); App.toast('O.S. excluída','success'); App.navigate('ordens'); }
    catch(e) { App.toast(e.message,'error'); }
  },

  async verificarHistorico() {
    const codigo = document.getElementById('peca-codigo')?.value?.trim();
    if (codigo && codigo.length >= 3) {
      clearTimeout(this._histDebounce);
      this._histDebounce = setTimeout(() => this.buscarHistorico(), 600);
    }
  },

  async buscarHistorico() {
    const codigo = document.getElementById('peca-codigo')?.value?.trim();
    const descricao = document.getElementById('peca-descricao')?.value?.trim();
    if (!codigo && !descricao) { App.toast('Informe o código ou descrição primeiro', 'error'); return; }

    const panel = document.getElementById('peca-historico-panel');
    const content = document.getElementById('peca-historico-content');
    if (!panel || !content) return;

    panel.style.display = 'block';
    content.innerHTML = '<div style="font-size:12px;color:var(--text-3)">Buscando…</div>';

    try {
      const params = new URLSearchParams();
      if (codigo)   params.set('codigo', codigo);
      else params.set('descricao', descricao);
      const data = await Api.get('/relatorios/historico-preco?' + params);

      if (!data.historico.length) {
        content.innerHTML = '<div style="font-size:12px;color:var(--text-4)">Nenhum histórico encontrado para esta peça.</div>';
        return;
      }

      const s = data.stats;
      content.innerHTML =
        // Stats
        (s ? '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">' +
          '<div style="text-align:center;padding:8px;background:var(--surface);border-radius:var(--radius)">' +
          '<div style="font-size:10px;color:var(--text-4)">Menor preço</div>' +
          '<div style="font-size:13px;font-weight:700;color:#16a34a">' + Fmt.moeda(s.menor_preco) + '</div></div>' +
          '<div style="text-align:center;padding:8px;background:var(--surface);border-radius:var(--radius)">' +
          '<div style="font-size:10px;color:var(--text-4)">Preço médio</div>' +
          '<div style="font-size:13px;font-weight:700;color:var(--brand2)">' + Fmt.moeda(s.media_preco) + '</div></div>' +
          '<div style="text-align:center;padding:8px;background:var(--surface);border-radius:var(--radius)">' +
          '<div style="font-size:10px;color:var(--text-4)">Último preço</div>' +
          '<div style="font-size:13px;font-weight:700">' + Fmt.moeda(s.ultimo_preco) + '</div></div>' +
          '<div style="text-align:center;padding:8px;background:var(--surface);border-radius:var(--radius)">' +
          '<div style="font-size:10px;color:var(--text-4)">Compras</div>' +
          '<div style="font-size:13px;font-weight:700">' + s.total_compras + 'x</div></div>' +
          '</div>' : '') +
        // Lista
        '<div style="display:flex;flex-direction:column;gap:5px;max-height:180px;overflow-y:auto">' +
        data.historico.slice(0,8).map(h =>
          '<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--surface);border-radius:var(--radius);font-size:11px">' +
          '<div style="flex:1"><strong>' + h.numero_os + '</strong> — ' + h.cliente + '</div>' +
          '<div style="color:var(--text-3)">' + h.fornecedor + '</div>' +
          '<div style="font-weight:600;color:var(--brand2)">' + Fmt.moeda(h.preco_fechado||h.preco_unitario) + '</div>' +
          (h.markup ? '<span style="background:#f0fdf4;color:#16a34a;padding:1px 6px;border-radius:20px;font-size:10px">' + h.markup + 'x</span>' : '') +
          '<div style="color:var(--text-4)">' + Fmt.data(h.atualizado_em) + '</div>' +
          // Botão usar este preço
          (h.preco_fechado ? '<button type="button" onclick="PageDetalheOS.usarPreco(' + h.preco_fechado + ',' + (h.preco_unitario||0) + ')" style="font-size:10px;padding:2px 7px;border-radius:4px;background:var(--brand2);color:#fff;border:none;cursor:pointer">Usar</button>' : '') +
          '</div>'
        ).join('') +
        '</div>';
    } catch(e) {
      content.innerHTML = '<div style="font-size:12px;color:var(--danger)">' + e.message + '</div>';
    }
  },

  usarPreco(preco_fechado, preco_venda) {
    if (preco_fechado) document.getElementById('peca-preco-fechado').value = preco_fechado;
    if (preco_venda)   document.getElementById('peca-preco-venda').value   = preco_venda;
    App.toast('Preços preenchidos!', 'success');
  },

  imprimirPDF() {
    const url = '/api/pdf-os/' + this.os.id + '?token=' + encodeURIComponent(Api.token);
    window.open(url, '_blank');
  },

  renderComentariosSelector() {
    if (!this.os.pecas.length) return '<div class="empty-state"><p>Adicione peças para poder comentar</p></div>';
    return '<div style="padding:0 4px">' +
      '<div style="font-size:12px;color:var(--text-3);margin-bottom:10px">Selecione uma peça para ver ou adicionar comentários:</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">' +
      this.os.pecas.map(p =>
        '<button onclick="PageDetalheOS.abrirComentarios(' + p.id + ',this)" style="padding:5px 10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface-2);font-size:11px;cursor:pointer;transition:all .15s" title="' + p.descricao + '">' +
        (p.codigo ? p.codigo + ' — ' : '') + p.descricao.substring(0,30) + (p.descricao.length>30?'…':'') +
        '</button>'
      ).join('') +
      '</div>' +
      '<div id="comentarios-peca-panel" style="display:none"></div>' +
      '</div>';
  },

  async abrirComentarios(pecaId, btn) {
    // Highlight botão ativo
    document.querySelectorAll('#comentarios-section button').forEach(b => {
      b.style.background = 'var(--surface-2)'; b.style.borderColor = 'var(--border)'; b.style.color = '';
    });
    btn.style.background = 'var(--brand2)'; btn.style.borderColor = 'var(--brand2)'; btn.style.color = '#fff';

    const panel = document.getElementById('comentarios-peca-panel');
    if (!panel) return;
    panel.style.display = 'block';
    panel.innerHTML = '<div style="font-size:12px;color:var(--text-3)">Carregando…</div>';
    this._pecaComentandoId = pecaId;

    try {
      const lista = await Api.get('/comentarios/' + pecaId);
      this.renderComentariosPanel(lista, pecaId);
    } catch(e) { panel.innerHTML = '<div class="alert alert-danger">' + e.message + '</div>'; }
  },

  renderComentariosPanel(lista, pecaId) {
    const panel = document.getElementById('comentarios-peca-panel');
    if (!panel) return;
    const peca = this.os.pecas.find(p => p.id === pecaId);
    panel.innerHTML =
      '<div style="background:var(--surface-2);border-radius:var(--radius-lg);padding:14px">' +
      '<div style="font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:10px">' +
      (peca ? '📦 ' + (peca.codigo ? peca.codigo+' — ' : '') + peca.descricao : '') + '</div>' +
      // Lista de comentários
      '<div id="lista-comentarios" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;max-height:200px;overflow-y:auto">' +
      (lista.length ? lista.map(c =>
        '<div style="display:flex;gap:10px;padding:8px 10px;background:var(--surface);border-radius:var(--radius);border-left:3px solid var(--brand2)">' +
        '<div style="flex:1">' +
        '<div style="font-size:12px;color:var(--text)">' + c.texto + '</div>' +
        '<div style="font-size:10px;color:var(--text-4);margin-top:3px">' +
        (c.usuario_nome||'Sistema') + ' · ' + Fmt.data(c.criado_em) + '</div>' +
        '</div>' +
        '<button onclick="PageDetalheOS.deletarComentario(' + c.id + ',' + pecaId + ')" style="color:var(--danger);background:none;border:none;cursor:pointer;font-size:14px;flex-shrink:0" title="Excluir">🗑</button>' +
        '</div>'
      ).join('') : '<div style="font-size:12px;color:var(--text-4);text-align:center;padding:10px">Nenhum comentário ainda</div>') +
      '</div>' +
      // Input novo comentário
      '<div style="display:flex;gap:8px">' +
      '<input id="novo-comentario" class="form-input" placeholder="Adicionar comentario..." style="flex:1" onkeydown="if(event.keyCode===13)PageDetalheOS.adicionarComentario(' + pecaId + ')">' +
      '<button class="btn btn-primary btn-sm" onclick="PageDetalheOS.adicionarComentario(' + pecaId + ')">Enviar</button>' +
      '</div></div>';
  },

  async adicionarComentario(pecaId) {
    const input = document.getElementById('novo-comentario');
    const texto = input?.value?.trim();
    if (!texto) return;
    try {
      await Api.post('/comentarios/' + pecaId, { texto });
      input.value = '';
      const lista = await Api.get('/comentarios/' + pecaId);
      this.renderComentariosPanel(lista, pecaId);
      App.toast('Comentário adicionado!', 'success');
    } catch(e) { App.toast(e.message, 'error'); }
  },

  async deletarComentario(id, pecaId) {
    if (!App.confirm('Excluir este comentário?')) return;
    try {
      await Api.delete('/comentarios/item/' + id);
      const lista = await Api.get('/comentarios/' + pecaId);
      this.renderComentariosPanel(lista, pecaId);
    } catch(e) { App.toast(e.message, 'error'); }
  },

  async duplicar() {
    const novoNum = prompt('Número da nova O.S. (deixe em branco para usar "' + this.os.numero_os + '-COPIA"):');
    if (novoNum === null) return; // cancelou
    try {
      const r = await Api.post('/os/' + this.os.id + '/duplicar', { numero_os: novoNum || '' });
      App.toast('O.S. ' + r.numero_os + ' criada com ' + r.pecas_copiadas + ' peças!', 'success');
      if (confirm('Ir para a nova O.S.?')) App.navigate('detalhe-os', { id: r.id });
    } catch(e) { App.toast(e.message, 'error'); }
  },

  exportarExcel() {
    if (!this.os?.pecas?.length) { App.toast('Nenhuma peça para exportar','error'); return; }
    const colunas = [
      { key:'codigo',               label:'Código'           },
      { key:'descricao',            label:'Descrição'        },
      { key:'quantidade',           label:'Quantidade'       },
      { key:'preco_unitario',       label:'Preço de Venda'   },
      { key:'preco_cotado',         label:'Preço Cotado'     },
      { key:'preco_fechado',        label:'Valor Fechado'    },
      { key:'fornecedor_nome',      label:'Fornecedor'       },
      { key:'transporte',           label:'Transportadora'   },
      { key:'status_entrega',       label:'Status'           },
      { key:'data_entrega_prevista',label:'Prev. Entrega'    },
      { key:'numero_rastreio',      label:'Rastreio'         },
      { key:'observacoes',          label:'Observações'      },
    ];
    ExportExcel.exportar(this.os.pecas, colunas, 'pecas-os-' + this.os.numero_os);
  },

  htmlModalPeca() {
    return '<div id="modal-peca" class="modal-backdrop hidden"><div class="modal modal-lg">' +
      '<div class="modal-header"><span class="modal-title" id="modal-peca-titulo">Adicionar peça</span>' +
      '<button class="btn-icon" onclick="PageDetalheOS.fecharModalPeca()">✕</button></div>' +
      '<div class="modal-body"><form id="form-peca" onsubmit="return false"><div class="form-grid mb-12">' +
      '<div class="form-group"><label class="form-label">Código</label><div style="display:flex;gap:6px">' +
      '<input id="peca-codigo" class="form-input" placeholder="EX-0001" oninput="PageDetalheOS.verificarHistorico()">' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="PageDetalheOS.buscarHistorico()" title="Ver histórico de preços" style="white-space:nowrap">📊 Histórico</button>' +
      '</div></div>' +
      '<div class="form-group"><label class="form-label required">Descrição</label><input id="peca-descricao" class="form-input"></div>' +
      '<div class="form-group"><label class="form-label">Quantidade</label><input id="peca-quantidade" class="form-input" type="number" min="1" value="1"></div>' +
      '<div class="form-group"><label class="form-label">Preço de Venda (ERP)</label><input id="peca-preco-venda" class="form-input" type="number" step="0.01"></div>' +
      '<div class="form-group"><label class="form-label">Preço Cotado</label><input id="peca-preco-cotado" class="form-input" type="number" step="0.01"></div>' +
      '<div class="form-group"><label class="form-label">Valor Fechado</label><input id="peca-preco-fechado" class="form-input" type="number" step="0.01"></div>' +
      '<div class="form-group form-full"><label class="form-label">Fornecedor</label><div id="peca-fornecedor-wrap"><input type="hidden" id="peca-fornecedor" value=""></div></div>' +
      // Transporte com datalist (digita e salva histórico)
      '<div class="form-group"><label class="form-label">Transportadora</label>' +
      '<input id="peca-transporte" class="form-input" list="transportes-list" placeholder="Ex: RODONAVES, SEDEX...">' +
      '<datalist id="transportes-list"></datalist>' +
      '<span class="form-hint">Digite ou escolha uma já usada</span></div>' +
      '<div class="form-group"><label class="form-label">Status de entrega</label><select id="peca-status" class="form-select">' +
      '<option>Pendente</option><option>Pedido realizado</option><option>Em trânsito</option><option>Entregue</option><option>Cancelado</option>' +
      '</select></div>' +
      '<div class="form-group"><label class="form-label">Data prevista de entrega</label><input id="peca-data-prev" class="form-input" type="date"></div>' +
      '<div class="form-group"><label class="form-label">Número de rastreio</label><input id="peca-rastreio" class="form-input" placeholder="BR0000000000AA"></div>' +
      '<div class="form-group form-full"><label class="form-label">Observações</label><textarea id="peca-obs" class="form-textarea"></textarea></div>' +
      '<div id="peca-historico-panel" style="display:none;margin-top:14px;padding:14px;background:var(--surface-2);border-radius:var(--radius);border-left:3px solid var(--brand2)">' +
      '<div style="font-size:12px;font-weight:700;margin-bottom:10px;color:var(--brand2)">📊 Histórico de preços desta peça</div>' +
      '<div id="peca-historico-content"></div>' +
      '</div>' +
      '</div></form></div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" onclick="PageDetalheOS.fecharModalPeca()">Cancelar</button>' +
      '<button class="btn btn-primary" onclick="PageDetalheOS.salvarPeca()">Salvar peça</button></div>' +
      '</div></div>';
  }
};
