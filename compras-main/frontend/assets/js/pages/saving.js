const PageSaving = {
  dados: null,
  leadTimes: null,
  abaAtiva: 'saving',

  async render() {
    document.getElementById('topbar-actions').innerHTML =
      '<button class="btn btn-secondary btn-sm" onclick="App.navigate(\'dashboard\')">← Dashboard</button>' +
      '<button class="btn btn-orange btn-sm" onclick="PageSaving.exportarCSV()">⬇ Exportar</button>';

    document.getElementById('content').innerHTML =
      '<div style="display:flex;gap:0;margin-bottom:16px;border-bottom:2px solid var(--border)">' +
      '<button onclick="PageSaving.trocarAba(\'saving\')" id="tab-saving" style="padding:10px 20px;background:none;border:none;cursor:pointer;font-size:13px;font-weight:600;color:var(--brand2);border-bottom:2px solid var(--brand2);margin-bottom:-2px">💰 Saving</button>' +
      '<button onclick="PageSaving.trocarAba(\'leadtime\')" id="tab-leadtime" style="padding:10px 20px;background:none;border:none;cursor:pointer;font-size:13px;font-weight:600;color:var(--text-3);border-bottom:2px solid transparent;margin-bottom:-2px">⏱ Lead Times</button>' +
      '</div>' +
      '<div id="aba-content"><div class="empty-state"><p>Carregando…</p></div></div>';

    await this.carregarSaving();
  },

  async trocarAba(aba) {
    this.abaAtiva = aba;
    // Atualiza visual das tabs
    document.getElementById('tab-saving').style.color   = aba === 'saving'   ? 'var(--brand2)' : 'var(--text-3)';
    document.getElementById('tab-leadtime').style.color = aba === 'leadtime' ? 'var(--brand2)' : 'var(--text-3)';
    document.getElementById('tab-saving').style.borderBottom   = aba === 'saving'   ? '2px solid var(--brand2)' : '2px solid transparent';
    document.getElementById('tab-leadtime').style.borderBottom = aba === 'leadtime' ? '2px solid var(--brand2)' : '2px solid transparent';

    if (aba === 'saving') await this.carregarSaving();
    else await this.carregarLeadTimes();
  },

  async carregarSaving() {
    if (!this.dados) {
      document.getElementById('aba-content').innerHTML = '<div class="empty-state"><p>Carregando…</p></div>';
      try { this.dados = await Api.get('/saving'); } catch(e) {
        document.getElementById('aba-content').innerHTML = '<div class="alert alert-danger">' + e.message + '</div>'; return;
      }
    }
    this.renderSaving();
  },

  async carregarLeadTimes() {
    if (!this.leadTimes) {
      document.getElementById('aba-content').innerHTML = '<div class="empty-state"><p>Carregando lead times…</p></div>';
      try { this.leadTimes = await Api.get('/saving/lead-times'); } catch(e) {
        document.getElementById('aba-content').innerHTML = '<div class="alert alert-danger">' + e.message + '</div>'; return;
      }
    }
    this.renderLeadTimes();
  },

  renderSaving() {
    const { totais, porMes, porFornecedor, topSaving } = this.dados;
    const savingTotal  = parseFloat(totais?.saving_total) || 0;
    const totalCotado  = parseFloat(totais?.total_cotado) || 0;
    const totalFechado = parseFloat(totais?.total_fechado) || 0;
    const savingPct    = totalCotado > 0 ? ((savingTotal / totalCotado) * 100).toFixed(1) : 0;
    const negociadas   = parseInt(totais?.pecas_negociadas) || 0;

    document.getElementById('aba-content').innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">' +
      '<div class="kpi-card warning"><div class="kpi-label">Total Cotado</div><div class="kpi-value" style="font-size:15px">' + Fmt.moeda(totalCotado) + '</div><div class="kpi-sub">valor negociado com fornecedor</div></div>' +
      '<div class="kpi-card success"><div class="kpi-label">Total Fechado</div><div class="kpi-value" style="font-size:15px">' + Fmt.moeda(totalFechado) + '</div><div class="kpi-sub">valor efetivamente pago</div></div>' +
      '<div class="kpi-card" style="background:#f0fdf4;border-top-color:#16a34a"><div class="kpi-label">💰 Saving Total (R$)</div><div class="kpi-value" style="font-size:18px;color:#16a34a;font-weight:800">' + Fmt.moeda(savingTotal) + '</div><div class="kpi-sub">cotado − fechado</div></div>' +
      '<div class="kpi-card" style="background:#f0fdf4;border-top-color:#16a34a"><div class="kpi-label">📊 Saving (%)</div><div class="kpi-value" style="font-size:24px;color:#16a34a;font-weight:800">' + savingPct + '%</div><div class="kpi-sub">' + negociadas + ' peças negociadas</div></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">' +
      '<div class="card"><div class="card-header"><div class="card-title">📅 Saving por Mês</div><div class="card-subtitle">Últimos 12 meses</div></div>' +
      (porMes.length ? this.renderBarChart(porMes) : '<div class="empty-state"><p>Sem dados ainda</p></div>') + '</div>' +
      '<div class="card"><div class="card-header"><div class="card-title">🏭 Saving por Fornecedor</div></div>' +
      (porFornecedor.length ?
        '<div class="table-wrap"><table><thead><tr><th>Fornecedor</th><th>Peças</th><th>Cotado</th><th>Fechado</th><th>Saving R$</th><th>Saving %</th></tr></thead><tbody>' +
        porFornecedor.map(f => {
          const saving = parseFloat(f.saving)||0, pct = parseFloat(f.saving_pct)||0;
          return '<tr><td><strong>' + f.fornecedor + '</strong></td><td style="text-align:center">' + f.total_pecas + '</td><td>' + Fmt.moeda(f.total_cotado) + '</td><td>' + Fmt.moeda(f.total_fechado) + '</td><td style="color:#16a34a;font-weight:700">' + Fmt.moeda(saving) + '</td><td><span style="background:#f0fdf4;color:#16a34a;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">' + pct + '%</span></td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="empty-state"><p>Sem dados</p></div>') + '</div></div>' +
      '<div class="card"><div class="card-header"><div class="card-title">🏆 Top 15 — Maiores Savings por Peça</div></div>' +
      (topSaving.length ?
        '<div class="table-wrap"><table><thead><tr><th>#</th><th>Peça</th><th>O.S.</th><th>Fornecedor</th><th>Qtd</th><th>Cotado</th><th>Fechado</th><th>Saving %</th><th>Saving Total</th></tr></thead><tbody>' +
        topSaving.map((p,i) => {
          const saving = parseFloat(p.saving_total)||0, pct = parseFloat(p.saving_pct)||0;
          return '<tr><td><span style="background:var(--surface-2);color:var(--text-3);padding:1px 6px;border-radius:4px;font-size:10px">' + (i+1) + '</span></td>' +
            '<td>' + (p.codigo ? '<code style="font-size:10px;background:var(--surface-3);padding:1px 5px;border-radius:4px;margin-right:4px">' + p.codigo + '</code>' : '') + p.descricao + '</td>' +
            '<td><strong>' + p.numero_os + '</strong><div style="font-size:10px;color:var(--text-4)">' + p.cliente + '</div></td>' +
            '<td style="font-size:11px">' + p.fornecedor + '</td>' +
            '<td style="text-align:center">' + p.quantidade + '</td>' +
            '<td>' + Fmt.moeda(p.preco_cotado) + '</td><td>' + Fmt.moeda(p.preco_fechado) + '</td>' +
            '<td><span style="background:#f0fdf4;color:#16a34a;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">' + pct + '%</span></td>' +
            '<td style="color:#16a34a;font-weight:700">' + Fmt.moeda(saving) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="empty-state"><p>Preencha Preço Cotado e Valor Fechado nas peças para calcular o saving.</p></div>') + '</div>';
  },

  renderLeadTimes() {
    const { medias, historico } = this.leadTimes;
    const m = medias || {};
    const dias = v => v != null ? parseFloat(v).toFixed(1) + 'd' : '—';

    const etapas = [
      { label: '📋 Primam → Compras', val: m.lt_primam_compras, desc: 'Tempo entre emissão no Primam e entrada em Compras' },
      { label: '🔍 Triagem', val: m.lt_triagem, desc: 'Tempo para o almoxarifado concluir a triagem' },
      { label: '💬 Cotação', val: m.lt_cotacao, desc: 'Tempo entre triagem e primeiro pedido realizado' },
      { label: '🚚 Pedido → Entrega', val: m.lt_entrega, desc: 'Tempo entre pedido realizado e entrega completa' },
      { label: '⏱ Lead Time Total', val: m.lt_total, desc: 'Entrada em Compras até entrega completa', destaque: true },
    ];

    document.getElementById('aba-content').innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:16px">' +
      etapas.map(e =>
        '<div class="kpi-card" style="' + (e.destaque ? 'background:#eff6ff;border-top-color:#1a56db' : '') + '" title="' + e.desc + '">' +
        '<div class="kpi-label">' + e.label + '</div>' +
        '<div class="kpi-value" style="font-size:22px;' + (e.destaque ? 'color:#1a56db' : '') + '">' + dias(e.val) + '</div>' +
        '<div class="kpi-sub">média</div></div>'
      ).join('') +
      '</div>' +

      (parseInt(m.total_os) > 0
        ? '<div class="card mb-14" style="background:#f0fdf4;border:1px solid #bbf7d0"><p style="font-size:12px;color:#166534;margin:0">📊 Baseado em <strong>' + m.total_os + '</strong> O.S. com ciclo completo registrado. As datas são capturadas automaticamente pelo sistema — importe os PDFs de O.S. e Pedidos de Compra para alimentar este relatório.</p></div>'
        : '<div class="card mb-14" style="background:#fffbeb;border:1px solid #fcd34d"><p style="font-size:12px;color:#92400e;margin:0">⏳ Nenhuma O.S. com ciclo completo ainda. Os lead times serão calculados automaticamente conforme você importar PDFs de O.S. e Pedidos de Compra e atualizar os status das peças.</p></div>') +

      '<div class="card"><div class="card-header"><div class="card-title">📋 Histórico de Lead Times por O.S.</div></div>' +
      (historico.length ?
        '<div class="table-wrap"><table>' +
        '<thead><tr><th>O.S.</th><th>Cliente</th><th>Entrada Compras</th><th>Triagem</th><th>1º Pedido</th><th>Todas Pedidas</th><th>Entrega</th><th>Lead Time Total</th></tr></thead>' +
        '<tbody>' + historico.map(os => {
          const lt = parseInt(os.lt_total_dias);
          const cor = lt > 30 ? '#dc2626' : lt > 15 ? '#d97706' : '#16a34a';
          return '<tr>' +
            '<td><strong>' + os.numero_os + '</strong></td>' +
            '<td style="font-size:11px">' + os.cliente + '</td>' +
            '<td>' + Fmt.data(os.data_entrada_compras) + '</td>' +
            '<td>' + Fmt.data(os.data_triagem_concluida) + '</td>' +
            '<td>' + Fmt.data(os.data_primeiro_pedido) + '</td>' +
            '<td>' + Fmt.data(os.data_todas_pedidas) + '</td>' +
            '<td>' + Fmt.data(os.data_entrega_completa) + '</td>' +
            '<td><span style="background:' + (lt?'#f0fdf4':'var(--surface-2)') + ';color:' + (lt?cor:'var(--text-4)') + ';padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">' + (lt ? lt + ' dias' : '—') + '</span></td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="empty-state"><p>Sem histórico disponível ainda.</p></div>') +
      '</div>';
  },

  renderBarChart(porMes) {
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const maxVal = Math.max(...porMes.map(m => parseFloat(m.saving)||0), 1);
    return '<div style="display:flex;align-items:flex-end;gap:6px;height:130px;padding:8px 0 0">' +
      porMes.map(m => {
        const saving = parseFloat(m.saving)||0;
        const pct    = Math.max(4, Math.round((saving/maxVal)*100));
        const label  = meses[parseInt(m.mes.split('-')[1])-1] + '/' + m.mes.split('-')[0].slice(2);
        return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px" title="' + label + ': Saving ' + Fmt.moeda(saving) + '">' +
          '<div style="font-size:9px;color:var(--text-4);font-weight:600">' + (saving>0?Fmt.moeda(saving).replace('R$','').trim():'') + '</div>' +
          '<div style="width:100%;background:#4ade80;border-radius:3px 3px 0 0;height:' + pct + '%;min-height:4px"></div>' +
          '<div style="font-size:9px;color:var(--text-4);white-space:nowrap">' + label + '</div>' +
          '</div>';
      }).join('') + '</div>';
  },

  exportarCSV() {
    if (!this.dados) { App.toast('Carregue os dados primeiro','error'); return; }
    const { porFornecedor, topSaving } = this.dados;
    let csv = 'RELATÓRIO DE SAVING — BRU Compressores\n';
    csv += 'Gerado em: ' + new Date().toLocaleDateString('pt-BR') + '\n\n';
    csv += 'POR FORNECEDOR\nFornecedor,Peças,Total Cotado,Total Fechado,Saving R$,Saving %\n';
    porFornecedor.forEach(f => {
      csv += '"' + f.fornecedor + '",' + f.total_pecas + ',' + parseFloat(f.total_cotado||0).toFixed(2) + ',' + parseFloat(f.total_fechado||0).toFixed(2) + ',' + parseFloat(f.saving||0).toFixed(2) + ',' + parseFloat(f.saving_pct||0).toFixed(1) + '%\n';
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'saving-' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    App.toast('Exportado!', 'success');
  }
};
