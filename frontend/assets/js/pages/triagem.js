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
      '<div class="card mb-14" style="background:#fffbeb;border:1px solid #fcd34d;border-radius:var(--radius-lg)">' +
      '<p style="font-size:12px;color:#92400e;margin:0">📋 Revise cada peça e marque se já está <strong>separada no almoxarifado</strong> ou se <strong>precisa ser comprada</strong>. Peças marcadas como compra entram automaticamente no fluxo de Rastreamento.</p>' +
      '</div>' +
      '<div id="lista-triagem">' +
      this.lista.map(os =>
        '<div class="card mb-10" style="cursor:pointer;transition:box-shadow .15s" onclick="PageTriagem.abrirOS(' + os.id + ')" onmouseover="this.style.boxShadow=\'0 2px 8px rgba(0,0,0,.1)\'" onmouseout="this.style.boxShadow=\'\'">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<strong style="font-size:14px">' + os.numero_os + '</strong>' +
        '<span class="badge ' + (os.tipo==='Pedido'?'badge-pedido':'badge-separadas') + '" style="font-size:9px">' + (os.tipo||'OS') + '</span>' +
        Fmt.prioridade(os.prioridade) +
        '</div>' +
        '<span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">' + os.pendentes_triagem + ' peça(s) aguardando</span>' +
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
    const pendentes   = os.pecas.filter(p => p.status_entrega === 'Aguardando Triagem');
    const jaDecididas = os.pecas.filter(p => p.status_entrega !== 'Aguardando Triagem');

    document.getElementById('topbar-actions').innerHTML =
      '<button class="btn btn-secondary btn-sm" onclick="PageTriagem.render()">← Voltar à lista</button>' +
      (pendentes.length === 0
        ? '<button class="btn btn-orange btn-sm" onclick="PageTriagem.finalizar()">✅ Concluir triagem</button>'
        : '');

    document.getElementById('content').innerHTML =
      // Cabeçalho da OS
      '<div class="card mb-14">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
      '<strong style="font-size:16px">' + os.numero_os + '</strong>' +
      '<span class="badge ' + (os.tipo==='Pedido'?'badge-pedido':'badge-separadas') + '" style="font-size:10px">' + (os.tipo||'OS') + '</span>' +
      Fmt.prioridade(os.prioridade) +
      '</div>' +
      '<div style="font-size:13px;color:var(--text-2)">' + os.cliente + ' — ' + os.equipamento + '</div>' +
      '</div>' +

      // Card de triagem
      '<div class="card">' +
      '<div class="card-header">' +
      '<div><div class="card-title">Triagem de peças</div>' +
      '<div class="card-subtitle" id="triagem-subtitulo">' + pendentes.length + ' aguardando decisão · ' + jaDecididas.length + ' já decididas</div></div>' +
      (pendentes.length > 0
        ? '<div style="display:flex;gap:6px">' +
          '<button class="btn btn-secondary btn-sm" onclick="PageTriagem.marcarTodas(\'separado\')">✓ Todas separadas</button>' +
          '<button class="btn btn-secondary btn-sm" onclick="PageTriagem.marcarTodas(\'comprar\')">🛒 Todas comprar</button>' +
          '</div>'
        : '') +
      '</div>' +
      '<div id="pecas-triagem-list">' +
      os.pecas.map(p => this.renderPecaRow(p)).join('') +
      '</div>' +
      '</div>';
  },

  renderPecaRow(p) {
    const isSeparado = p.status_entrega === 'Separado (Almoxarifado)';
    const isComprar  = p.status_entrega === 'Pendente';
    const aguardando = p.status_entrega === 'Aguardando Triagem';

    return '<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:var(--radius);margin-bottom:6px;background:' +
      (isSeparado ? '#f0fdf4' : isComprar ? '#fff' : 'var(--surface-2)') +
      ';border:1px solid ' + (isSeparado ? '#bbf7d0' : isComprar ? '#e2e8f0' : 'var(--border)') + '" data-peca-id="' + p.id + '">' +

      // Info da peça
      '<div style="flex:1;min-width:0">' +
      '<div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
      (p.codigo ? '<code style="font-size:10px;background:var(--surface-3);padding:1px 5px;border-radius:4px;margin-right:6px">' + p.codigo + '</code>' : '') +
      p.descricao + '</div>' +
      '<div style="font-size:11px;color:var(--text-4);margin-top:2px">Qtd: ' + p.quantidade + ' · ' + Fmt.moeda(p.preco_unitario) + '</div>' +
      '</div>' +

      // Status atual
      '<div style="min-width:120px;text-align:center">' +
      (isSeparado
        ? '<span style="font-size:11px;background:#dcfce7;color:#166534;padding:3px 10px;border-radius:20px;font-weight:600">✓ Separado</span>'
        : isComprar
        ? '<span style="font-size:11px;background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:20px;font-weight:600">🛒 Comprar</span>'
        : '<span style="font-size:11px;background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:20px;font-weight:600">⏳ Aguardando</span>') +
      '</div>' +

      // Botões de decisão
      '<div style="display:flex;gap:6px;flex-shrink:0">' +
      '<button onclick="PageTriagem.decidir(' + p.id + ',\'separado\')" style="padding:6px 12px;border-radius:var(--radius);font-size:11px;font-weight:600;cursor:pointer;border:1px solid ' + (isSeparado ? '#16a34a' : 'var(--border)') + ';background:' + (isSeparado ? '#dcfce7' : 'var(--surface)') + ';color:' + (isSeparado ? '#166534' : 'var(--text-2)') + ';transition:all .15s">✓ Separado</button>' +
      '<button onclick="PageTriagem.decidir(' + p.id + ',\'comprar\')" style="padding:6px 12px;border-radius:var(--radius);font-size:11px;font-weight:600;cursor:pointer;border:1px solid ' + (isComprar ? '#dc2626' : 'var(--border)') + ';background:' + (isComprar ? '#fee2e2' : 'var(--surface)') + ';color:' + (isComprar ? '#991b1b' : 'var(--text-2)') + ';transition:all .15s">🛒 Comprar</button>' +
      '</div>' +
      '</div>';
  },

  async decidir(pecaId, decisao) {
    try {
      await Api.put('/triagem/peca/' + pecaId, { decisao });
      const peca = this.osAtual.pecas.find(p => p.id === pecaId);
      if (peca) peca.status_entrega = decisao === 'separado' ? 'Separado (Almoxarifado)' : 'Pendente';
      // Atualiza só a linha
      const row = document.querySelector('[data-peca-id="' + pecaId + '"]');
      if (row) row.outerHTML = this.renderPecaRow(peca);
      this.atualizarHeader();
    } catch(e) { App.toast(e.message, 'error'); }
  },

  atualizarHeader() {
    const pendentes = this.osAtual.pecas.filter(p => p.status_entrega === 'Aguardando Triagem');
    const decididas = this.osAtual.pecas.length - pendentes.length;
    const sub = document.getElementById('triagem-subtitulo');
    if (sub) sub.textContent = pendentes.length + ' aguardando decisão · ' + decididas + ' já decididas';
    if (pendentes.length === 0) {
      document.getElementById('topbar-actions').innerHTML =
        '<button class="btn btn-secondary btn-sm" onclick="PageTriagem.render()">← Voltar à lista</button>' +
        '<button class="btn btn-orange btn-sm" onclick="PageTriagem.finalizar()">✅ Concluir triagem</button>';
    }
  },

  async marcarTodas(decisao) {
    const pendentes = this.osAtual.pecas.filter(p => p.status_entrega === 'Aguardando Triagem');
    for (const p of pendentes) {
      try {
        await Api.put('/triagem/peca/' + p.id, { decisao });
        p.status_entrega = decisao === 'separado' ? 'Separado (Almoxarifado)' : 'Pendente';
      } catch(e) {}
    }
    this.renderTriagemOS();
    App.toast('Todas marcadas!', 'success');
  },

  async finalizar() {
    if (!App.confirm('Concluir a triagem desta O.S.? Peças ainda aguardando serão marcadas como "Pendente" automaticamente.')) return;
    try {
      await Api.post('/triagem/' + this.osAtual.id + '/finalizar');
      App.toast('Triagem concluída!', 'success');
      this.render();
    } catch(e) { App.toast(e.message, 'error'); }
  }
};
