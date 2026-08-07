const PageConfiguracoes = {
  cfg: {},
  _lista: [],

  async render() {
    document.getElementById('topbar-actions').innerHTML =
      '<button class="btn btn-secondary btn-sm" onclick="App.navigate(\'dashboard\')">← Dashboard</button>';
    document.getElementById('content').innerHTML = '<div class="empty-state"><p>Carregando…</p></div>';
    try {
      const [cfg, usuarios] = await Promise.all([
        Api.get('/configuracoes').catch(() => ({})),
        Api.get('/usuarios').catch(() => [])
      ]);
      this.cfg = cfg;
      this._lista = usuarios;
      this.renderPagina();
    } catch(e) {
      document.getElementById('content').innerHTML = '<div class="alert alert-danger">' + e.message + '</div>';
    }
  },

  kpiDefs: [
    { key: 'total_os',     icon: '📋', label: 'Total de O.S.' },
    { key: 'aguardando',   icon: '⏳', label: 'Aguardando peças' },
    { key: 'atrasadas',    icon: '⚠️', label: 'O.S. atrasadas' },
    { key: 'transito',     icon: '🚚', label: 'Em trânsito' },
    { key: 'pendentes',    icon: '📦', label: 'Entregas pendentes' },
    { key: 'concluidas',   icon: '✅', label: 'Concluídas' },
    { key: 'valor_aberto', icon: '💰', label: 'Valor em aberto' },
    { key: 'markup_medio', icon: '📈', label: 'Markup Médio' },
  ],

  renderPagina() {
    const c = this.cfg;
    const ocultos = JSON.parse(c.dashboard_ocultos || '[]');
    const ordem   = JSON.parse(c.dashboard_ordem   || '[]');

    // Ordena KPIs conforme salvo
    const kpisOrdenados = ordem.length
      ? [...this.kpiDefs].sort((a,b) => {
          const ia = ordem.indexOf(a.key), ib = ordem.indexOf(b.key);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        })
      : [...this.kpiDefs];

    document.getElementById('content').innerHTML =
      '<div style="max-width:860px;display:grid;grid-template-columns:1fr 1fr;gap:16px">' +

      // ── Markup Sinaleiro ──────────────────────────────────────────────────
      '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">🎯 Markup — Sinaleiro</div>' +
      '<div class="card-subtitle">Fórmula: Preço de Venda ÷ Valor Fechado</div></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:12px">' +
      '<div class="form-group"><label class="form-label">🟢 Verde — markup mínimo</label>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
      '<input id="cfg-verde" class="form-input" type="number" step="0.1" value="' + (c.markup_verde||'2.2') + '" style="max-width:100px">' +
      '<span style="font-size:12px;color:var(--text-3)">x ou acima</span></div></div>' +
      '<div class="form-group"><label class="form-label">🟡 Laranja — markup mínimo</label>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
      '<input id="cfg-laranja" class="form-input" type="number" step="0.1" value="' + (c.markup_laranja||'2.0') + '" style="max-width:100px">' +
      '<span style="font-size:12px;color:var(--text-3)">x ou acima</span></div></div>' +
      '<div style="padding:10px;background:var(--surface-2);border-radius:var(--radius);font-size:11px">' +
      '<span style="color:#15803d">🟢 ≥ ' + (c.markup_verde||2.2) + 'x</span> &nbsp;|&nbsp; ' +
      '<span style="color:#d97706">🟡 ' + (c.markup_laranja||2.0) + '–' + (parseFloat(c.markup_verde||2.2)-0.01).toFixed(2) + 'x</span> &nbsp;|&nbsp; ' +
      '<span style="color:#dc2626">🔴 &lt; ' + (c.markup_laranja||2.0) + 'x</span></div>' +
      '</div>' +
      '<div style="padding-top:14px"><button class="btn btn-primary" onclick="PageConfiguracoes.salvarMarkup()">Salvar markup</button></div>' +
      '</div>' +

      // ── Dashboard ─────────────────────────────────────────────────────────
      '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">📊 Dashboard — KPIs</div>' +
      '<div class="card-subtitle">Arraste para reordenar. Marque para mostrar.</div></div></div>' +
      '<div id="kpi-sort-list" style="display:flex;flex-direction:column;gap:6px">' +
      kpisOrdenados.map((k, i) => {
        const ativo = !ocultos.includes(k.key);
        return '<div class="kpi-sort-item" draggable="true" data-key="' + k.key + '"' +
          ' ondragstart="PageConfiguracoes.dragStart(event)"' +
          ' ondragover="PageConfiguracoes.dragOver(event)"' +
          ' ondrop="PageConfiguracoes.drop(event)"' +
          ' style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:' + (ativo?'var(--surface-2)':'var(--surface-3)') + ';border-radius:var(--radius);cursor:grab;border:1px solid var(--border);transition:background .15s">' +
          '<span style="color:var(--text-4);font-size:12px;cursor:grab">⠿</span>' +
          '<span style="font-size:14px">' + k.icon + '</span>' +
          '<span style="flex:1;font-size:12px;color:' + (ativo?'var(--text)':'var(--text-4)') + '">' + k.label + '</span>' +
          '<label style="display:flex;align-items:center;gap:5px;cursor:pointer">' +
          '<input type="checkbox" data-kpi="' + k.key + '" ' + (ativo?'checked':'') + ' onchange="PageConfiguracoes.toggleKPI(this)">' +
          '<span style="font-size:11px;color:var(--text-3)">' + (ativo?'visível':'oculto') + '</span></label>' +
          '</div>';
      }).join('') +
      '</div>' +
      '<div style="padding-top:14px"><button class="btn btn-primary" onclick="PageConfiguracoes.salvarDashboard()">Salvar dashboard</button></div>' +
      '</div>' +

      // ── Usuários (full width) ─────────────────────────────────────────────
      '<div class="card" style="grid-column:1/-1">' +
      '<div class="card-header"><div class="card-title">👤 Usuários do sistema</div>' +
      '<button class="btn btn-orange btn-sm" onclick="PageConfiguracoes.abrirModalUsuario()">+ Novo usuário</button></div>' +
      '<div class="table-wrap"><table>' +
      '<thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Status</th><th>Desde</th><th></th></tr></thead>' +
      '<tbody>' + this._lista.map(u =>
        '<tr><td><strong>' + u.nome + '</strong></td><td>' + u.email + '</td>' +
        '<td><span class="badge ' + (u.papel==='admin'?'badge-alta':'badge-media') + '">' + u.papel + '</span></td>' +
        '<td><span class="badge ' + (u.ativo?'badge-concluida':'badge-cancelado') + '">' + (u.ativo?'Ativo':'Inativo') + '</span></td>' +
        '<td>' + Fmt.data(u.criado_em) + '</td>' +
        '<td style="white-space:nowrap">' +
        '<button class="btn-icon" onclick="PageConfiguracoes.editarUsuario(' + u.id + ')">✏</button>' +
        '<button class="btn-icon" onclick="PageConfiguracoes.desativarUsuario(' + u.id + ',' + u.ativo + ')" style="color:var(--warning)">' + (u.ativo?'🚫':'✅') + '</button></td></tr>'
      ).join('') +
      '</tbody></table></div></div>' +

      '</div>' + this.htmlModalUsuario();
  },

  // ── Drag & Drop ──────────────────────────────────────────────────────────
  _dragKey: null,
  dragStart(e) {
    this._dragKey = e.currentTarget.dataset.key;
    e.currentTarget.style.opacity = '0.5';
  },
  dragOver(e) {
    e.preventDefault();
    e.currentTarget.style.background = 'var(--brand-light)';
  },
  drop(e) {
    e.preventDefault();
    const target = e.currentTarget;
    target.style.background = '';
    const targetKey = target.dataset.key;
    if (!this._dragKey || this._dragKey === targetKey) { this._dragKey = null; return; }

    const list = document.getElementById('kpi-sort-list');
    const items = Array.from(list.querySelectorAll('.kpi-sort-item'));
    const dragEl   = items.find(i => i.dataset.key === this._dragKey);
    const targetEl = items.find(i => i.dataset.key === targetKey);
    if (dragEl && targetEl) {
      const dragIdx   = items.indexOf(dragEl);
      const targetIdx = items.indexOf(targetEl);
      if (dragIdx < targetIdx) list.insertBefore(dragEl, targetEl.nextSibling);
      else list.insertBefore(dragEl, targetEl);
      // Reset opacity
      dragEl.style.opacity = '1';
    }
    this._dragKey = null;
  },

  toggleKPI(checkbox) {
    const item = checkbox.closest('.kpi-sort-item');
    const ativo = checkbox.checked;
    item.style.background = ativo ? 'var(--surface-2)' : 'var(--surface-3)';
    item.querySelector('span:last-of-type').textContent = ativo ? 'visível' : 'oculto';
    item.querySelector('span[style*="color"]').style.color = ativo ? 'var(--text)' : 'var(--text-4)';
  },

  // ── Salvar ────────────────────────────────────────────────────────────────
  async salvarMarkup() {
    const verde   = parseFloat(document.getElementById('cfg-verde').value);
    const laranja = parseFloat(document.getElementById('cfg-laranja').value);
    if (isNaN(verde)||isNaN(laranja)) { App.toast('Valores inválidos','error'); return; }
    if (laranja >= verde) { App.toast('Verde deve ser maior que Laranja','error'); return; }
    try {
      await Api.put('/configuracoes', { markup_verde: String(verde), markup_laranja: String(laranja) });
      App.toast('Markup salvo!', 'success');
      this.cfg = await Api.get('/configuracoes');
      this.renderPagina();
    } catch(e) { App.toast(e.message, 'error'); }
  },

  async salvarDashboard() {
    const items  = Array.from(document.querySelectorAll('.kpi-sort-item'));
    const ordem  = items.map(i => i.dataset.key);
    const ocultos= items.filter(i => !i.querySelector('input[type=checkbox]').checked).map(i => i.dataset.key);
    try {
      await Api.put('/configuracoes', {
        dashboard_ordem:   JSON.stringify(ordem),
        dashboard_ocultos: JSON.stringify(ocultos)
      });
      App.toast('Dashboard salvo!', 'success');
      this.cfg = await Api.get('/configuracoes');
      this.renderPagina();
    } catch(e) { App.toast(e.message, 'error'); }
  },

  // ── Usuários inline ──────────────────────────────────────────────────────
  abrirModalUsuario(id) {
    const u = id ? this._lista.find(x => x.id === id) : null;
    this._editUsrId = id || null;
    document.getElementById('cfg-usr-titulo').textContent = id ? 'Editar usuário' : 'Novo usuário';
    document.getElementById('cfg-usr-nome').value  = u?.nome  || '';
    document.getElementById('cfg-usr-email').value = u?.email || '';
    document.getElementById('cfg-usr-papel').value = u?.papel || 'operador';
    document.getElementById('cfg-usr-senha').value = '';
    document.getElementById('cfg-usr-hint').textContent = id ? 'Deixe em branco para não alterar' : '';
    document.getElementById('modal-cfg-usuario').classList.remove('hidden');
  },

  editarUsuario(id) { this.abrirModalUsuario(id); },
  fecharModalUsuario() { document.getElementById('modal-cfg-usuario').classList.add('hidden'); },

  async salvarUsuario() {
    const payload = {
      nome:  document.getElementById('cfg-usr-nome').value.trim(),
      email: document.getElementById('cfg-usr-email').value.trim(),
      papel: document.getElementById('cfg-usr-papel').value,
      senha: document.getElementById('cfg-usr-senha').value || undefined
    };
    if (!payload.nome||!payload.email) { App.toast('Nome e e-mail obrigatórios','error'); return; }
    if (!this._editUsrId && !payload.senha) { App.toast('Senha obrigatória para novo usuário','error'); return; }
    try {
      if (this._editUsrId) await Api.put('/usuarios/'+this._editUsrId, payload);
      else await Api.post('/usuarios', payload);
      App.toast('Usuário salvo!','success');
      this.fecharModalUsuario();
      this._lista = await Api.get('/usuarios');
      this.renderPagina();
    } catch(e) { App.toast(e.message,'error'); }
  },

  async desativarUsuario(id, ativo) {
    if (!App.confirm((ativo?'Desativar':'Reativar') + ' este usuário?')) return;
    try {
      await Api.put('/usuarios/'+id, { ativo: !ativo });
      App.toast(ativo?'Desativado':'Reativado','success');
      this._lista = await Api.get('/usuarios');
      this.renderPagina();
    } catch(e) { App.toast(e.message,'error'); }
  },

  htmlModalUsuario() {
    return '<div id="modal-cfg-usuario" class="modal-backdrop hidden"><div class="modal">' +
      '<div class="modal-header"><span class="modal-title" id="cfg-usr-titulo">Novo usuário</span>' +
      '<button class="btn-icon" onclick="PageConfiguracoes.fecharModalUsuario()">✕</button></div>' +
      '<div class="modal-body"><div class="form-grid">' +
      '<div class="form-group form-full"><label class="form-label required">Nome</label><input id="cfg-usr-nome" class="form-input"></div>' +
      '<div class="form-group"><label class="form-label required">E-mail</label><input id="cfg-usr-email" class="form-input" type="email"></div>' +
      '<div class="form-group"><label class="form-label">Papel</label><select id="cfg-usr-papel" class="form-select"><option value="operador">Operador</option><option value="admin">Administrador</option></select></div>' +
      '<div class="form-group form-full"><label class="form-label">Senha</label><input id="cfg-usr-senha" class="form-input" type="password"><span class="form-hint" id="cfg-usr-hint"></span></div>' +
      '</div></div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" onclick="PageConfiguracoes.fecharModalUsuario()">Cancelar</button>' +
      '<button class="btn btn-primary" onclick="PageConfiguracoes.salvarUsuario()">Salvar</button></div>' +
      '</div></div>';
  }
};
