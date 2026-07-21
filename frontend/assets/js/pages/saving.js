const PageSaving = {
  dados: null,

  async render() {
    document.getElementById('topbar-actions').innerHTML =
      '<button class="btn btn-secondary btn-sm" onclick="App.navigate(\'dashboard\')">← Dashboard</button>' +
      '<button class="btn btn-orange btn-sm" onclick="PageSaving.exportarCSV()">⬇ Exportar</button>';

    document.getElementById('content').innerHTML = '<div class="empty-state"><p>Carregando saving…</p></div>';
    try {
      this.dados = await Api.get('/saving');
      this.renderPagina();
    } catch(e) {
      document.getElementById('content').innerHTML = '<div class="alert alert-danger">' + e.message + '</div>';
    }
  },

  renderPagina() {
    const { totais, porMes, porFornecedor, topSaving } = this.dados;
    const savingTotal   = parseFloat(totais?.saving_total) || 0;
    const totalCotado   = parseFloat(totais?.total_cotado) || 0;
    const totalFechado  = parseFloat(totais?.total_fechado) || 0;
    const savingPct     = totalCotado > 0 ? ((savingTotal / totalCotado) * 100).toFixed(1) : 0;
    const negociadas    = parseInt(totais?.pecas_negociadas) || 0;

    document.getElementById('content').innerHTML =

      // ── KPIs ──────────────────────────────────────────────────────────────
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">' +
      '<div class="kpi-card warning"><div class="kpi-label">Total Cotado</div><div class="kpi-value" style="font-size:15px">' + Fmt.moeda(totalCotado) + '</div><div class="kpi-sub">valor negociado com fornecedor</div></div>' +
      '<div class="kpi-card success"><div class="kpi-label">Total Fechado</div><div class="kpi-value" style="font-size:15px">' + Fmt.moeda(totalFechado) + '</div><div class="kpi-sub">valor efetivamente pago</div></div>' +
      '<div class="kpi-card" style="background:#f0fdf4;border-top-color:#16a34a"><div class="kpi-label">💰 Saving Total (R$)</div><div class="kpi-value" style="font-size:18px;color:#16a34a;font-weight:800">' + Fmt.moeda(savingTotal) + '</div><div class="kpi-sub">cotado − fechado</div></div>' +
      '<div class="kpi-card" style="background:#f0fdf4;border-top-color:#16a34a"><div class="kpi-label">📊 Saving (%)</div><div class="kpi-value" style="font-size:24px;color:#16a34a;font-weight:800">' + savingPct + '%</div><div class="kpi-sub">' + negociadas + ' peças negociadas</div></div>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">' +

      // ── Saving por mês ─────────────────────────────────────────────────────
      '<div class="card">' +
      '<div class="card-header"><div class="card-title">📅 Saving por Mês</div><div class="card-subtitle">Últimos 12 meses</div></div>' +
      (porMes.length ? this.renderBarChart(porMes) : '<div class="empty-state"><p>Sem dados ainda</p></div>') +
      '</div>' +

      // ── Por fornecedor ──────────────────────────────────────────────────────
      '<div class="card">' +
      '<div class="card-header"><div class="card-title">🏭 Saving por Fornecedor</div></div>' +
      (porFornecedor.length ?
        '<div class="table-wrap"><table>' +
        '<thead><tr><th>Fornecedor</th><th>Peças</th><th>Cotado</th><th>Fechado</th><th>Saving R$</th><th>Saving %</th></tr></thead>' +
        '<tbody>' + porFornecedor.map(f => {
          const saving = parseFloat(f.saving) || 0;
          const pct    = parseFloat(f.saving_pct) || 0;
          return '<tr>' +
            '<td><strong>' + f.fornecedor + '</strong></td>' +
            '<td style="text-align:center">' + f.total_pecas + '</td>' +
            '<td>' + Fmt.moeda(f.total_cotado) + '</td>' +
            '<td>' + Fmt.moeda(f.total_fechado) + '</td>' +
            '<td style="color:#16a34a;font-weight:700">' + Fmt.moeda(saving) + '</td>' +
            '<td><span style="background:#f0fdf4;color:#16a34a;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">' + pct + '%</span></td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="empty-state"><p>Sem dados</p></div>') +
      '</div>' +
      '</div>' +

      // ── Top savings por peça ────────────────────────────────────────────────
      '<div class="card">' +
      '<div class="card-header"><div class="card-title">🏆 Top 15 — Maiores Savings por Peça</div>' +
      '<div class="card-subtitle">Cotado vs Fechado</div></div>' +
      (topSaving.length ?
        '<div class="table-wrap"><table>' +
        '<thead><tr><th>#</th><th>Peça</th><th>O.S.</th><th>Fornecedor</th><th>Qtd</th><th>Cotado Unit.</th><th>Fechado Unit.</th><th>Saving %</th><th>Saving Total</th></tr></thead>' +
        '<tbody>' + topSaving.map((p, i) => {
          const saving = parseFloat(p.saving_total) || 0;
          const pct    = parseFloat(p.saving_pct)   || 0;
          return '<tr>' +
            '<td><span style="background:var(--surface-2);color:var(--text-3);padding:1px 6px;border-radius:4px;font-size:10px">' + (i+1) + '</span></td>' +
            '<td>' + (p.codigo ? '<code style="font-size:10px;background:var(--surface-3);padding:1px 5px;border-radius:4px;margin-right:4px">' + p.codigo + '</code>' : '') + p.descricao + '</td>' +
            '<td><strong>' + p.numero_os + '</strong><div style="font-size:10px;color:var(--text-4)">' + p.cliente + '</div></td>' +
            '<td style="font-size:11px">' + p.fornecedor + '</td>' +
            '<td style="text-align:center">' + p.quantidade + '</td>' +
            '<td>' + Fmt.moeda(p.preco_cotado) + '</td>' +
            '<td>' + Fmt.moeda(p.preco_fechado) + '</td>' +
            '<td><span style="background:#f0fdf4;color:#16a34a;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">' + pct + '%</span></td>' +
            '<td style="color:#16a34a;font-weight:700">' + Fmt.moeda(saving) + '</td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>'
        : '<div class="empty-state"><p>Preencha Preço Cotado e Valor Fechado nas peças para calcular o saving.</p></div>') +
      '</div>';
  },

  renderBarChart(porMes) {
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const maxVal = Math.max(...porMes.map(m => parseFloat(m.saving)||0), 1);
    return '<div style="display:flex;align-items:flex-end;gap:6px;height:130px;padding:8px 0 0">' +
      porMes.map(m => {
        const saving = parseFloat(m.saving) || 0;
        const pct    = Math.max(4, Math.round((saving / maxVal) * 100));
        const label  = meses[parseInt(m.mes.split('-')[1])-1] + '/' + m.mes.split('-')[0].slice(2);
        const savingPct = m.total_cotado > 0 ? ((saving / m.total_cotado)*100).toFixed(1) : 0;
        return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px" title="' + label + ': Saving ' + Fmt.moeda(saving) + ' (' + savingPct + '%)">' +
          '<div style="font-size:9px;color:var(--text-4);font-weight:600">' + (saving > 0 ? Fmt.moeda(saving).replace('R$','').trim() : '') + '</div>' +
          '<div style="width:100%;background:#4ade80;border-radius:3px 3px 0 0;height:' + pct + '%;min-height:4px"></div>' +
          '<div style="font-size:9px;color:var(--text-4);white-space:nowrap">' + label + '</div>' +
          '</div>';
      }).join('') +
      '</div>';
  },

  exportarCSV() {
    if (!this.dados) { App.toast('Carregue os dados primeiro','error'); return; }
    const { porFornecedor, topSaving } = this.dados;
    let csv = 'RELATÓRIO DE SAVING — BRU Compressores\n';
    csv += 'Gerado em: ' + new Date().toLocaleDateString('pt-BR') + '\n\n';
    csv += 'POR FORNECEDOR\n';
    csv += 'Fornecedor,Peças,Total Cotado,Total Fechado,Saving R$,Saving %\n';
    porFornecedor.forEach(f => {
      csv += '"' + f.fornecedor + '",' + f.total_pecas + ',' +
        parseFloat(f.total_cotado||0).toFixed(2) + ',' +
        parseFloat(f.total_fechado||0).toFixed(2) + ',' +
        parseFloat(f.saving||0).toFixed(2) + ',' +
        parseFloat(f.saving_pct||0).toFixed(1) + '%\n';
    });
    csv += '\nTOP SAVINGS POR PEÇA\n';
    csv += 'Peça,Código,O.S.,Cliente,Fornecedor,Qtd,Cotado Unit.,Fechado Unit.,Saving %,Saving Total\n';
    topSaving.forEach(p => {
      csv += '"' + p.descricao + '","' + (p.codigo||'') + '","' + p.numero_os + '","' + p.cliente + '","' + p.fornecedor + '",' +
        p.quantidade + ',' + parseFloat(p.preco_cotado||0).toFixed(2) + ',' + parseFloat(p.preco_fechado||0).toFixed(2) + ',' +
        parseFloat(p.saving_pct||0).toFixed(1) + '%,' + parseFloat(p.saving_total||0).toFixed(2) + '\n';
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
