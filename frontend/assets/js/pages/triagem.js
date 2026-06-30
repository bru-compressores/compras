const PageTriagem = {
  lista: [],
  osAtual: null,

  async render() {
    document.getElementById('topbar-actions').innerHTML =
      '<button class="btn btn-secondary btn-sm" onclick="App.navigate(\'dashboard\')">← Dashboard</button>';

    document.getElementById('content').innerHTML = '<div class="empty-state"><p>Carregando…</p></div>';
    try {
      this.lista = await Api.get('/triagem');
      this.renderLista();
    } catch(e) {
      document.getElementById('content').innerHTML = '<div class="alert alert-danger">' + e.message + '</div>';
    }
  },

  renderLista() {
    if (!this.lista.length) {
      document.getElementById('content').innerHTML =
        '<div class="empty-state"><p>✅ Nenhuma O.S. aguardando triagem do almoxarifado!</p></div>';
      return;
    }

    document.getElementById('content').innerHTML =
      '<div class="card mb-14" style="background:var(--info-bg);border:none">' +
      '<p style="font-size:12px;color:var(--info);margin:0">📋 Revise cada peça e marque se já está <strong>separada no almoxarifado</strong> ou se <strong>precisa ser comprada</strong>. Peças marcadas como compra entram automaticamente no fluxo de Rastreamento.</p>' +
      '</div>' +
      '<div id="lista-triagem">' +
      this.lista.map(os =>
        '<div class="triagem-os-card" onclick="PageTriagem.abrirOS(' + os.id + ')">' +
        '<div style="display:flex;align-items:center;justify-content:space-between">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<strong style="font-size:14px">' + os.numero_os + '</strong>' +
        '<span class="badge ' + (os.tipo==='Pedido'?'badge-pedido':'badge-separadas') + '" style="font-size:9px">' + (os.tipo||'OS') + '</span>' +
        Fmt.prioridade(os.prioridade) +
        '</div>' +
        '<span class="badge badge-triagem">' + os.pendentes_triagem + ' peça(s) aguardando</span>' +
        '</div>' +
        '<div style="font-size:13px;color:var(--text-2);margin-top:6px">' + os.cliente + '</div>' +
        '<div style="font-size:11px;color:var(--text-4);margin-top:2px">' + os.equipamento + '</div>' +
        '</div>'
      ).join('') +
      '</div>';
  },

  async abrirOS(osId) {
    document.getElementById('content').innerHTML = '<div class="empty-state"><p>Carregando…</p></div>';
    try {
      this.osAtual = await Api.get('/triagem/' + osId);
      this.renderTriagemOS();
    } catch(e) { App.toast(e.message, 'error'); }
  },

  renderTriagemOS() {
    const os = this.osAtual;
    const pendentes = os.pecas.filter(p => p.status_entrega === 'Aguardando Triagem');
    const jaDecididas = os.pecas.filter(p => p.status_entrega !== 'Aguardando Triagem');

    document.getElementById('topbar-actions').innerHTML =
      '<button class="btn btn-secondary btn-sm" onclick="PageTriagem.render()">← Voltar à lista</button>' +
      (pendentes.length === 0
        ? '<button class="btn btn-orange btn-sm" onclick="PageTriagem.finalizar()">✅ Concluir triagem</button>'
        : '');

    document.getElementById('content').innerHTML =
      '<div class="card mb-14">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
      '<strong style="font-size:16px">' + os.numero_os + '</strong>' +
      '<span class="badge ' + (os.tipo==='Pedido'?'badge-pedido':'badge-separadas') + '" style="font-size:10px">' + (os.tipo||'OS') + '</span>' +
      Fmt.prioridade(os.prioridade) +
      '</div>' +
      '<div style="font-size:13px;color:var(--text-2)">' + os.cliente + ' — ' + os.equipamento + '</div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">Triagem de peças</div>' +
      '<div class="card-subtitle">' + pendentes.length + ' aguardando decisão · ' + jaDecididas.length + ' já decididas</div></div>' +
      (pendentes.length > 0 ? '<div style="display:flex;gap:6px">' +
        '<button class="btn btn-secondary btn-sm" onclick="PageTriagem.marcarTodas(\'separado\')">✓ Todas separadas</button>' +
        '<button class="btn btn-secondary btn-sm" onclick="PageTriagem.marcarTodas(\'comprar\')">🛒 Todas comprar</button>' +
        '</div>' : '') +
      '</div>' +
      '<div id="pecas-triagem-list">' +
      os.pecas.map(p => this.renderPecaRow(p)).join('') +
      '</div>' +
      '</div>';
  },

  renderPecaRow(p) {
    const decidido = p.status_entrega !== 'Aguardando Triagem';
    const isSeparado = p.status_entrega === 'Separado (Almoxarifado)';
    const isComprar = decidido && !isSeparado;

    return '<div class="triagem-peca-row" data-peca-id="' + p.id + '">' +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-size:13px;font-weight:600">' +
      (p.codigo ? '<code style="font-size:10px;background:var(--surface-3);padding:1px 5px;border-radius:4px;margin-right:6px">' + p.codigo + '</code>' : '') +
      p.descricao + '</div>' +
      '<div style="font-size:11px;color:var(--text-4);margin-top:2px">Qtd: ' + p.quantidade + ' · ' + Fmt.moeda(p.preco_unitario) + '</div>' +
      '</div>' +
      '<button class="triagem-btn ' + (isSeparado?'ativo-separado':'') + '" onclick="PageTriagem.decidir(' + p.id + ',\'separado\')">' +
      '✓ Separado (Almox.)</button>' +
      '<button class="triagem-btn ' + (isComprar?'ativo-comprar':'') + '" onclick="PageTriagem.decidir(' + p.id + ',\'comprar\')">' +
      '🛒 Comprar</button>' +
      '</div>';
  },

  async decidir(pecaId, decisao) {
    try {
      await Api.put('/triagem/peca/' + pecaId, { decisao });
      // Atualiza localmente sem recarregar tudo
      const peca = this.osAtual.pecas.find(p => p.id === pecaId);
      if (peca) peca.status_entrega = decisao === 'separado' ? 'Separado (Almoxarifado)' : 'Pendente';
      // Re-renderiza só a linha
      const row = document.querySelector('[data-peca-id="' + pecaId + '"]');
      if (row) row.outerHTML = this.renderPecaRow(peca);
      // Atualiza header (contador e botão concluir)
      this.atualizarHeader();
    } catch(e) { App.toast(e.message, 'error'); }
  },

  atualizarHeader() {
    const pendentes = this.osAtual.pecas.filter(p => p.status_entrega === 'Aguardando Triagem');
    document.querySelector('.card-subtitle').textContent =
      pendentes.length + ' aguardando decisão · ' + (this.osAtual.pecas.length - pendentes.length) + ' já decididas';
    if (pendentes.length === 0) {
      document.getElementById('topbar-actions').innerHTML =
        '<button class="btn btn-secondary btn-sm" onclick="PageTriagem.render()">← Voltar à lista</button>' +
        '<button class="btn btn-orange btn-sm" onclick="PageTriagem.finalizar()">✅ Concluir triagem</button>';
    }
  },

  async marcarTodas(decisao) {
    const pendentes = this.osAtual.pecas.filter(p => p.status_entrega === 'Aguardando Triagem');
    for (const p of pendentes) {
      try { await Api.put('/triagem/peca/' + p.id, { decisao }); p.status_entrega = decisao === 'separado' ? 'Separado (Almoxarifado)' : 'Pendente'; } catch(e) {}
    }
    this.renderTriagemOS();
    App.toast('Todas marcadas!', 'success');
  },

  async finalizar() {
    if (!App.confirm('Concluir a triagem desta O.S.?')) return;
    try {
      await Api.post('/triagem/' + this.osAtual.id + '/finalizar');
      App.toast('Triagem concluída!', 'success');
      this.render();
    } catch(e) { App.toast(e.message, 'error'); }
  }
};
