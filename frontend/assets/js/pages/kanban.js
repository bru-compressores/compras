const PageKanban = {
  dados: {},
  _dragging: null,

  colunas: [
    { status: 'Aberta',           cor: '#9ca3af', bg: '#f9fafb', icon: '📋' },
    { status: 'Aguardando peças', cor: '#d97706', bg: '#fffbeb', icon: '⏳' },
    { status: 'Peças separadas',  cor: '#1a56db', bg: '#eff6ff', icon: '📦' },
    { status: 'Concluída',        cor: '#059669', bg: '#f0fdf4', icon: '✅' },
  ],

  async render() {
    document.getElementById('topbar-actions').innerHTML =
      '<button class="btn btn-secondary btn-sm" onclick="App.navigate(\'ordens\')">☰ Lista</button>' +
      '<button class="btn btn-orange btn-sm" onclick="PageOrdens.abrirModal ? PageOrdens.abrirModal() : App.navigate(\'ordens\')">+ Nova O.S.</button>';

    document.getElementById('content').innerHTML =
      '<div style="font-size:12px;color:var(--text-3);margin-bottom:12px">Arraste os cards para mudar o status</div>' +
      '<div id="kanban-board" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:start"></div>';

    await this.carregar();
  },

  async carregar() {
    try {
      const data = await Api.get('/os?limite=200&pagina=1');
      this.dados = {};
      this.colunas.forEach(c => this.dados[c.status] = []);
      data.registros.forEach(os => {
        if (this.dados[os.status] !== undefined) this.dados[os.status].push(os);
        else this.dados['Aberta'].push(os);
      });
      this.renderBoard();
    } catch(e) {
      document.getElementById('kanban-board').innerHTML = '<div class="alert alert-danger">' + e.message + '</div>';
    }
  },

  renderBoard() {
    const board = document.getElementById('kanban-board');
    if (!board) return;
    board.innerHTML = this.colunas.map(col => {
      const cards = this.dados[col.status] || [];
      return '<div class="kanban-col" data-status="' + col.status + '"' +
        ' ondragover="PageKanban.dragOver(event)"' +
        ' ondrop="PageKanban.drop(event)"' +
        ' ondragleave="PageKanban.dragLeave(event)"' +
        ' style="background:' + col.bg + ';border-radius:var(--radius-lg);padding:12px;border-top:3px solid ' + col.cor + ';min-height:200px">' +
        // Header da coluna
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
        '<div style="display:flex;align-items:center;gap:6px">' +
        '<span>' + col.icon + '</span>' +
        '<span style="font-size:12px;font-weight:700;color:' + col.cor + '">' + col.status + '</span>' +
        '</div>' +
        '<span style="background:' + col.cor + ';color:#fff;border-radius:20px;padding:2px 8px;font-size:11px;font-weight:700">' + cards.length + '</span>' +
        '</div>' +
        // Cards
        cards.map(os => this.renderCard(os, col)).join('') +
        '</div>';
    }).join('');
  },

  renderCard(os, col) {
    const pc  = os.total_pecas || 0;
    const ent = os.pecas_entregues || 0;
    const pct = pc > 0 ? Math.round(ent/pc*100) : 0;
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const prazo = os.data_conclusao_estimada ? new Date(os.data_conclusao_estimada + 'T00:00:00') : null;
    const diasRestantes = prazo ? Math.round((prazo - hoje) / (1000*60*60*24)) : null;
    const atrasado = diasRestantes !== null && diasRestantes < 0;
    const urgente  = diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 3;

    return '<div class="kanban-card" draggable="true"' +
      ' data-id="' + os.id + '"' +
      ' data-status="' + os.status + '"' +
      ' ondragstart="PageKanban.dragStart(event)"' +
      ' ondragend="PageKanban.dragEnd(event)"' +
      ' onclick="App.navigate(\'detalhe-os\',{id:' + os.id + '})"' +
      ' style="background:var(--surface);border-radius:var(--radius);padding:12px;margin-bottom:8px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.08);transition:transform .15s,box-shadow .15s;border-left:3px solid ' +
      (os.prioridade === 'Alta' ? '#dc2626' : os.prioridade === 'Média' ? '#d97706' : '#9ca3af') + '">' +

      // Número + tipo + prioridade
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
      '<div style="display:flex;align-items:center;gap:5px">' +
      '<strong style="font-size:13px">' + os.numero_os + '</strong>' +
      '<span style="font-size:9px;padding:1px 5px;border-radius:10px;background:' + (os.tipo==='Pedido'?'#ede9fe':'#dbeafe') + ';color:' + (os.tipo==='Pedido'?'#7c3aed':'#1d4ed8') + '">' + (os.tipo||'OS') + '</span>' +
      '</div>' +
      Fmt.prioridade(os.prioridade) +
      '</div>' +

      // Cliente
      '<div style="font-size:11px;color:var(--text-3);margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + os.cliente + '</div>' +

      // Equipamento
      '<div style="font-size:10px;color:var(--text-4);margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + os.equipamento + '</div>' +

      // Progress bar de peças
      (pc > 0 ? '<div style="margin-bottom:6px">' +
        '<div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text-4);margin-bottom:2px">' +
        '<span>Peças</span><span>' + ent + '/' + pc + '</span></div>' +
        '<div style="height:3px;background:var(--surface-3);border-radius:2px">' +
        '<div style="height:100%;background:' + (pct===100?'#059669':'#1a56db') + ';border-radius:2px;width:' + pct + '%"></div>' +
        '</div></div>' : '') +

      // Prazo
      (prazo ? '<div style="margin-top:4px">' +
        (atrasado
          ? '<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:#fee2e2;color:#dc2626;font-weight:700">🔴 ' + Math.abs(diasRestantes) + 'd atraso</span>'
          : urgente
          ? '<span style="font-size:10px;padding:2px 7px;border-radius:20px;background:#fef3c7;color:#d97706;font-weight:700">🟡 ' + diasRestantes + 'd</span>'
          : '<span style="font-size:10px;color:var(--text-4)">' + Fmt.data(os.data_conclusao_estimada) + '</span>') +
        '</div>' : '') +

      '</div>';
  },

  // ── Drag & Drop ───────────────────────────────────────────────────────────
  dragStart(e) {
    this._dragging = {
      id:     e.currentTarget.dataset.id,
      status: e.currentTarget.dataset.status
    };
    e.currentTarget.style.opacity = '0.4';
    e.currentTarget.style.transform = 'rotate(2deg)';
    e.dataTransfer.effectAllowed = 'move';
  },

  dragEnd(e) {
    e.currentTarget.style.opacity = '1';
    e.currentTarget.style.transform = '';
    // Limpa highlights
    document.querySelectorAll('.kanban-col').forEach(c => {
      c.style.outline = '';
      c.style.background = '';
    });
  },

  dragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const col = e.currentTarget;
    const status = col.dataset.status;
    const colDef = this.colunas.find(c => c.status === status);
    if (colDef) col.style.outline = '2px dashed ' + colDef.cor;
  },

  dragLeave(e) {
    e.currentTarget.style.outline = '';
  },

  async drop(e) {
    e.preventDefault();
    const col = e.currentTarget;
    col.style.outline = '';
    const novoStatus = col.dataset.status;
    if (!this._dragging || this._dragging.status === novoStatus) return;

    const osId     = this._dragging.id;
    const oldStatus= this._dragging.status;
    this._dragging = null;

    try {
      await Api.put('/os/' + osId, { status: novoStatus, obs_historico: 'Movido via Kanban' });
      App.toast('Status: ' + novoStatus, 'success');
      await this.carregar();
    } catch(e2) { App.toast(e2.message, 'error'); }
  }
};
