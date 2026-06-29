const PageRastreamento = {
  filtros: { status: '', busca: '', prioridade: '', tipo: '' },
  _pecasCache: null,

  async render() {
    document.getElementById('topbar-actions').innerHTML =
      '<button class="btn btn-secondary btn-sm" onclick="App.navigate(\'dashboard\')">← Dashboard</button>' +
      '<button class="btn btn-secondary btn-sm" onclick="PageRastreamento.exportarExcel()">⬇ Excel</button>';

    document.getElementById('content').innerHTML =
      '<div class="card mb-14">' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' +
      '<span style="font-size:11px;font-weight:600;color:var(--text-3);align-self:center;margin-right:4px">Filtro rápido:</span>' +
      ['Todos','Pendente','Pedido realizado','Em trânsito'].map((s,i) =>
        '<button class="pill' + (i===0?' active':'') + '" onclick="PageRastreamento.filtroRapido(this,\'' + (i===0?'':s) + '\')">' + s + '</button>'
      ).join('') +
      '</div>' +
      '<div class="filters-bar">' +
      '<input type="text" class="form-input search-input" placeholder="Buscar O.S., cliente ou peça…" id="rast-busca" oninput="PageRastreamento.filtrar()">' +
      '<select class="form-select filter-select" id="rast-prioridade" onchange="PageRastreamento.filtrar()">' +
      '<option value="">Todas prioridades</option><option>Alta</option><option>Média</option><option>Baixa</option></select>' +
      '<select class="form-select filter-select" id="rast-tipo" onchange="PageRastreamento.filtrar()">' +
      '<option value="">Todos os tipos</option><option value="OS">Ordem de Serviço</option><option value="Pedido">Pedido de Peças</option></select>' +
      '</div>' +
      '<div id="rast-tabela"></div></div>';

    await this.carregar();
  },

  filtroRapido(btn, status) {
    document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.filtros.status = status;
    this.carregar();
  },

  filtrar() {
    this.filtros.busca      = document.getElementById('rast-busca')?.value || '';
    this.filtros.prioridade = document.getElementById('rast-prioridade')?.value || '';
    this.filtros.tipo       = document.getElementById('rast-tipo')?.value || '';
    clearTimeout(this._d);
    this._d = setTimeout(() => this.carregar(), 300);
  },

  async carregar() {
    try {
      let pecas = await Api.get('/pecas/entregas-pendentes');
      const { status, busca, prioridade, tipo } = this.filtros;
      if (status)     pecas = pecas.filter(p => p.status_entrega === status);
      if (prioridade) pecas = pecas.filter(p => p.prioridade === prioridade);
      if (tipo)       pecas = pecas.filter(p => p.tipo === tipo);
      if (busca) {
        const b = busca.toLowerCase();
        pecas = pecas.filter(p =>
          (p.numero_os||'').toLowerCase().includes(b) ||
          (p.cliente||'').toLowerCase().includes(b) ||
          (p.descricao||'').toLowerCase().includes(b) ||
          (p.codigo||'').toLowerCase().includes(b)
        );
      }
      this._pecasCache = pecas;

      const el = document.getElementById('rast-tabela');
      if (!el) return;
      if (!pecas.length) {
        el.innerHTML = '<div class="empty-state"><p>Nenhuma entrega pendente com esses filtros!</p></div>';
        return;
      }

      const colsRast = [
        { key:'prioridade',           label:'Prior.',        tipo:'str'  },
        { key:'numero_os',            label:'O.S.',          tipo:'str'  },
        { key:'cliente',              label:'Cliente',       tipo:'str'  },
        { key:'descricao',            label:'Peça',          tipo:'str'  },
        { key:'fornecedor_nome',      label:'Fornecedor',    tipo:'str'  },
        { key:'transporte',           label:'Transportadora',tipo:'str'  },
        { key:'status_entrega',       label:'Status',        tipo:'str'  },
        { key:'data_entrega_prevista',label:'Previsão',      tipo:'date' },
        { key:'numero_rastreio',      label:'Rastreio',      tipo:'str'  },
      ];
      TableSort.registrar('rast-table', () => this.renderLinhas(pecas, colsRast));
      this.renderLinhas(pecas, colsRast);
    } catch(e) {
      const el = document.getElementById('rast-tabela');
      if (el) el.innerHTML = '<div class="alert alert-danger">' + e.message + '</div>';
    }
  },

  exportarExcel() {
    const pecas = this._pecasCache;
    if (!pecas?.length) { App.toast('Nenhum dado para exportar','error'); return; }
    const colunas = [
      { key:'numero_os',            label:'O.S.'          },
      { key:'cliente',              label:'Cliente'        },
      { key:'descricao',            label:'Peça'           },
      { key:'codigo',               label:'Código'         },
      { key:'fornecedor_nome',      label:'Fornecedor'     },
      { key:'transporte',           label:'Transportadora' },
      { key:'status_entrega',       label:'Status'         },
      { key:'data_entrega_prevista',label:'Prev. Entrega'  },
      { key:'numero_rastreio',      label:'Rastreio'       },
      { key:'prioridade',           label:'Prioridade'     },
    ];
    ExportExcel.exportar(pecas, colunas, 'rastreamento-pecas');
  },

  renderLinhas(pecas, cols) {
    const { headers, dadosOrdenados } = TableSort.init('rast-table', cols, pecas, null, null);
    const porStatus = {};
    dadosOrdenados.forEach(p => { porStatus[p.status_entrega] = (porStatus[p.status_entrega]||0)+1; });
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const rows = dadosOrdenados.map(p => {
      const atrasada = p.data_entrega_prevista && new Date(p.data_entrega_prevista+'T00:00:00') < hoje;
      return '<tr onclick="App.navigate(\'detalhe-os\',{id:' + p.os_id + '})" style="cursor:pointer' + (atrasada ? ';background:#fff5f5' : '') + '">' +
        '<td>' + Fmt.prioridade(p.prioridade) + '</td>' +
        '<td><strong>' + p.numero_os + '</strong><span class="badge ' + (p.tipo==='Pedido'?'badge-pedido':'badge-separadas') + '" style="margin-left:4px;font-size:9px">' + (p.tipo||'OS') + '</span></td>' +
        '<td>' + p.cliente + '</td>' +
        '<td>' + (p.codigo ? '<code style="font-size:10px">' + p.codigo + '</code> ' : '') + p.descricao + '</td>' +
        '<td>' + (p.fornecedor_nome||'<span class="text-muted">—</span>') + '</td>' +
        '<td>' + (p.transporte ? '<span style="font-size:11px;background:var(--surface-2);padding:2px 7px;border-radius:4px">' + p.transporte + '</span>' : '<span class="text-muted">—</span>') + '</td>' +
        '<td>' + Fmt.statusEntrega(p.status_entrega) + '</td>' +
        '<td>' + (p.data_entrega_prevista ? Fmt.semaforoPrazo(p.data_entrega_prevista) : '<span class="text-muted">—</span>') + '</td>' +
        '<td>' + (p.numero_rastreio ? '<code style="font-size:10px">' + p.numero_rastreio + '</code>' : '<span class="text-muted">—</span>') + '</td>' +
        '</tr>';
    }).join('');
    const el = document.getElementById('rast-tabela');
    if (!el) return;
    el.innerHTML =
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' +
      Object.entries(porStatus).map(([s,n]) => '<span style="font-size:11px;padding:3px 10px;border-radius:20px;background:var(--surface-2);color:var(--text-2)">' + s + ': <strong>' + n + '</strong></span>').join('') +
      '<span style="font-size:11px;padding:3px 10px;border-radius:20px;background:var(--brand2);color:#fff">Total: <strong>' + dadosOrdenados.length + '</strong></span>' +
      '</div>' +
      '<div class="table-wrap"><table><thead><tr>' + headers + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
};


// ─── Fornecedores ──────────────────────────────────────────────────────────
const PageFornecedores = {
  async render() {
    document.getElementById('topbar-actions').innerHTML =
      '<button class="btn btn-orange" onclick="PageFornecedores.abrirModal()">+ Novo fornecedor</button>';
    document.getElementById('content').innerHTML =
      '<div class="card"><div class="filters-bar">' +
      '<input type="text" class="form-input search-input" placeholder="Buscar fornecedor, CNPJ ou cidade…" id="busca-forn" oninput="PageFornecedores.filtrar()">' +
      '</div><div id="tabela-forn"></div></div>' + this.htmlModal();
    await this.carregar();
  },

  filtrar() { clearTimeout(this._d); this._d = setTimeout(() => this.carregar(), 300); },

  async carregar() {
    const busca = document.getElementById('busca-forn')?.value || '';
    const params = busca ? '?busca=' + encodeURIComponent(busca) : '';
    try {
      const lista = await Api.get('/fornecedores' + params);
      if (!lista.length) {
        document.getElementById('tabela-forn').innerHTML = '<div class="empty-state"><p>Nenhum fornecedor cadastrado</p></div>';
        return;
      }
      const colsForn = [
        { key:'nome',     label:'Nome',     tipo:'str' },
        { key:'cnpj',     label:'CNPJ',     tipo:'str' },
        { key:'contato',  label:'Contato',  tipo:'str' },
        { key:'telefone', label:'Telefone', tipo:'str' },
        { key:'email',    label:'E-mail',   tipo:'str' },
        { key:'cidade',   label:'Cidade/UF',tipo:'str' },
        { key:'total_pecas',label:'Peças',  tipo:'num' },
      ];
      TableSort.registrar('forn-table', () => PageFornecedores.carregar());
      const { headers: hForn, dadosOrdenados: listaOrd } = TableSort.init('forn-table', colsForn, lista, null, null);
      document.getElementById('tabela-forn').innerHTML =
        '<div class="table-wrap"><table>' +
        '<thead><tr>' + hForn + '<th></th></tr></thead>' +
        '<tbody>' + listaOrd.map(f =>
          '<tr><td><strong>' + f.nome + '</strong></td>' +
          '<td class="text-muted" style="font-size:11px">' + (f.cnpj||'—') + '</td>' +
          '<td>' + (f.contato||'—') + '</td>' +
          '<td>' + (f.telefone||'—') + '</td>' +
          '<td>' + (f.email||'—') + '</td>' +
          '<td class="text-muted">' + (f.cidade ? f.cidade + (f.estado?'/'+f.estado:'') : '—') + '</td>' +
          '<td><span class="badge badge-separadas">' + (f.total_pecas||0) + '</span></td>' +
          '<td style="white-space:nowrap">' +
          '<button class="btn-icon" onclick="PageFornecedores.editar(' + f.id + ')" title="Editar">✏</button>' +
          '<button class="btn-icon" onclick="PageFornecedores.excluir(' + f.id + ')" title="Excluir" style="color:var(--danger);font-size:16px">🗑</button>' +
          '</td></tr>'
        ).join('') + '</tbody></table></div>';
    } catch(e) {
      document.getElementById('tabela-forn').innerHTML = '<div class="alert alert-danger">' + e.message + '</div>';
    }
  },

  abrirModal(id) {
    this._editId = id||null;
    document.getElementById('modal-forn-titulo').textContent = id ? 'Editar fornecedor' : 'Novo fornecedor';
    if (!id) ['forn-nome','forn-cnpj','forn-contato','forn-telefone','forn-email','forn-cidade','forn-estado'].forEach(i => { const el=document.getElementById(i); if(el)el.value=''; });
    document.getElementById('modal-forn').classList.remove('hidden');
  },

  async editar(id) {
    try {
      const f = await Api.get('/fornecedores/' + id);
      this.abrirModal(id);
      document.getElementById('forn-nome').value    = f.nome||'';
      document.getElementById('forn-cnpj').value    = f.cnpj||'';
      document.getElementById('forn-contato').value = f.contato||'';
      document.getElementById('forn-telefone').value= f.telefone||'';
      document.getElementById('forn-email').value   = f.email||'';
      document.getElementById('forn-cidade').value  = f.cidade||'';
      document.getElementById('forn-estado').value  = f.estado||'';
    } catch(e) { App.toast(e.message,'error'); }
  },

  fecharModal() { document.getElementById('modal-forn').classList.add('hidden'); },

  async salvar() {
    const payload = {
      nome:     document.getElementById('forn-nome').value.trim(),
      cnpj:     document.getElementById('forn-cnpj').value.trim()||null,
      contato:  document.getElementById('forn-contato').value.trim()||null,
      telefone: document.getElementById('forn-telefone').value.trim()||null,
      email:    document.getElementById('forn-email').value.trim()||null,
      cidade:   document.getElementById('forn-cidade').value.trim()||null,
      estado:   document.getElementById('forn-estado').value.trim()||null
    };
    if (!payload.nome) { App.toast('Nome é obrigatório','error'); return; }
    try {
      if (this._editId) await Api.put('/fornecedores/'+this._editId, payload);
      else await Api.post('/fornecedores', payload);
      App.toast('Fornecedor salvo!','success');
      this.fecharModal(); await this.carregar();
    } catch(e) { App.toast(e.message,'error'); }
  },

  async excluir(id) {
    if (!App.confirm('Excluir este fornecedor?')) return;
    try { await Api.delete('/fornecedores/'+id); App.toast('Removido','success'); await this.carregar(); }
    catch(e) { App.toast(e.message,'error'); }
  },

  htmlModal() {
    return '<div id="modal-forn" class="modal-backdrop hidden"><div class="modal">' +
      '<div class="modal-header"><span class="modal-title" id="modal-forn-titulo">Novo fornecedor</span>' +
      '<button class="btn-icon" onclick="PageFornecedores.fecharModal()">✕</button></div>' +
      '<div class="modal-body"><div class="form-grid">' +
      '<div class="form-group form-full"><label class="form-label required">Nome / Razão Social</label><input id="forn-nome" class="form-input"></div>' +
      '<div class="form-group"><label class="form-label">CNPJ / CPF</label><input id="forn-cnpj" class="form-input" placeholder="00.000.000/0000-00"></div>' +
      '<div class="form-group"><label class="form-label">Contato</label><input id="forn-contato" class="form-input"></div>' +
      '<div class="form-group"><label class="form-label">Telefone</label><input id="forn-telefone" class="form-input"></div>' +
      '<div class="form-group"><label class="form-label">E-mail</label><input id="forn-email" class="form-input" type="email"></div>' +
      '<div class="form-group"><label class="form-label">Cidade</label><input id="forn-cidade" class="form-input"></div>' +
      '<div class="form-group"><label class="form-label">Estado</label><input id="forn-estado" class="form-input" placeholder="SP" maxlength="2"></div>' +
      '</div></div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" onclick="PageFornecedores.fecharModal()">Cancelar</button>' +
      '<button class="btn btn-primary" onclick="PageFornecedores.salvar()">Salvar</button></div>' +
      '</div></div>';
  }
};

// ─── Usuários ──────────────────────────────────────────────────────────────
const PageUsuarios = {
  async render() {
    document.getElementById('topbar-actions').innerHTML =
      '<button class="btn btn-secondary btn-sm" onclick="App.navigate(\'dashboard\')">← Dashboard</button>' +
      '<button class="btn btn-orange" onclick="PageUsuarios.abrirModal()">+ Novo usuário</button>';
    document.getElementById('content').innerHTML = '<div class="empty-state"><p>Carregando…</p></div>';
    try {
      const lista = await Api.get('/usuarios');
      document.getElementById('content').innerHTML =
        '<div class="card"><div class="table-wrap"><table>' +
        '<thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Status</th><th>Desde</th><th></th></tr></thead>' +
        '<tbody>' + lista.map(u =>
          '<tr><td><strong>' + u.nome + '</strong></td><td>' + u.email + '</td>' +
          '<td><span class="badge ' + (u.papel==='admin'?'badge-alta':'badge-media') + '">' + u.papel + '</span></td>' +
          '<td><span class="badge ' + (u.ativo?'badge-concluida':'badge-cancelado') + '">' + (u.ativo?'Ativo':'Inativo') + '</span></td>' +
          '<td>' + Fmt.data(u.criado_em) + '</td>' +
          '<td><button class="btn-icon" onclick="PageUsuarios.editar(' + u.id + ')">✏</button>' +
          '<button class="btn-icon" onclick="PageUsuarios.desativar(' + u.id + ',' + u.ativo + ')" style="color:var(--warning)">' + (u.ativo?'🚫':'✅') + '</button></td></tr>'
        ).join('') + '</tbody></table></div></div>' + this.htmlModal();
      this._lista = lista;
    } catch(e) {
      document.getElementById('content').innerHTML = '<div class="alert alert-danger">' + e.message + '</div>';
    }
  },

  abrirModal(id) {
    const u = id ? this._lista?.find(x=>x.id===id) : null;
    this._editId = id||null;
    document.getElementById('modal-usuario-titulo').textContent = id ? 'Editar usuário' : 'Novo usuário';
    document.getElementById('usr-nome').value  = u?.nome||'';
    document.getElementById('usr-email').value = u?.email||'';
    document.getElementById('usr-papel').value = u?.papel||'operador';
    document.getElementById('usr-senha').value = '';
    document.getElementById('usr-senha-hint').textContent = id ? 'Deixe em branco para não alterar' : '';
    document.getElementById('modal-usuario').classList.remove('hidden');
  },

  editar(id) { this.abrirModal(id); },
  fecharModal() { document.getElementById('modal-usuario').classList.add('hidden'); },

  async salvar() {
    const payload = {
      nome:  document.getElementById('usr-nome').value.trim(),
      email: document.getElementById('usr-email').value.trim(),
      papel: document.getElementById('usr-papel').value,
      senha: document.getElementById('usr-senha').value||undefined
    };
    if (!payload.nome||!payload.email) { App.toast('Nome e e-mail são obrigatórios','error'); return; }
    if (!this._editId&&!payload.senha) { App.toast('Senha obrigatória para novo usuário','error'); return; }
    try {
      if (this._editId) await Api.put('/usuarios/'+this._editId, payload);
      else await Api.post('/usuarios', payload);
      App.toast('Usuário salvo!','success');
      this.fecharModal(); this.render();
    } catch(e) { App.toast(e.message,'error'); }
  },

  async desativar(id, ativo) {
    if (!App.confirm((ativo?'Desativar':'Reativar')+' este usuário?')) return;
    try { await Api.put('/usuarios/'+id,{ativo:!ativo}); App.toast(ativo?'Desativado':'Reativado','success'); this.render(); }
    catch(e) { App.toast(e.message,'error'); }
  },

  htmlModal() {
    return '<div id="modal-usuario" class="modal-backdrop hidden"><div class="modal">' +
      '<div class="modal-header"><span class="modal-title" id="modal-usuario-titulo">Novo usuário</span>' +
      '<button class="btn-icon" onclick="PageUsuarios.fecharModal()">✕</button></div>' +
      '<div class="modal-body"><div class="form-grid">' +
      '<div class="form-group form-full"><label class="form-label required">Nome</label><input id="usr-nome" class="form-input"></div>' +
      '<div class="form-group"><label class="form-label required">E-mail</label><input id="usr-email" class="form-input" type="email"></div>' +
      '<div class="form-group"><label class="form-label">Papel</label><select id="usr-papel" class="form-select"><option value="operador">Operador</option><option value="admin">Administrador</option></select></div>' +
      '<div class="form-group form-full"><label class="form-label">Senha</label><input id="usr-senha" class="form-input" type="password"><span class="form-hint" id="usr-senha-hint"></span></div>' +
      '</div></div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" onclick="PageUsuarios.fecharModal()">Cancelar</button>' +
      '<button class="btn btn-primary" onclick="PageUsuarios.salvar()">Salvar</button></div>' +
      '</div></div>';
  }
};

// ─── Importar ──────────────────────────────────────────────────────────────
