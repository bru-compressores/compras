const PageRelatorios = {
  dados: null,

  async render() {
    document.getElementById('topbar-actions').innerHTML =
      '<button class="btn btn-secondary btn-sm" onclick="App.navigate(\'dashboard\')">← Dashboard</button>' +
      '<button class="btn btn-orange btn-sm" onclick="PageRelatorios.exportarExcel()">⬇ Exportar Excel</button>';

    document.getElementById('content').innerHTML = '<div class="empty-state"><p>Carregando relatórios…</p></div>';
    try {
      this.dados = await Api.get('/relatorios/economia');
      this.renderPagina();
    } catch(e) {
      document.getElementById('content').innerHTML = '<div class="alert alert-danger">' + e.message + '</div>';
    }
  },

  renderPagina() {
    const { porFornecedor, porMes, totais, topEconomia } = this.dados;
    const economiaTotalVF = totais ? (totais.total_venda - totais.total_fechado) : 0;
    const economiaTotalCF = totais ? (totais.total_cotado - totais.total_fechado) : 0;
    const mkMedio = totais?.total_venda > 0 && totais?.total_fechado > 0
      ? (totais.total_venda / totais.total_fechado).toFixed(2) : '—';

    document.getElementById('content').innerHTML =

      // ── KPIs de economia ──────────────────────────────────────────────────
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">' +
      '<div class="kpi-card info"><div class="kpi-label">Peças com valor fechado</div><div class="kpi-value">' + (totais?.total_pecas||0) + '</div><div class="kpi-sub">negociadas</div></div>' +
      '<div class="kpi-card warning"><div class="kpi-label">Total Preço de Venda</div><div class="kpi-value" style="font-size:15px">' + Fmt.moeda(totais?.total_venda) + '</div><div class="kpi-sub">valor ERP</div></div>' +
      '<div class="kpi-card success"><div class="kpi-label">Total Valor Fechado</div><div class="kpi-value" style="font-size:15px">' + Fmt.moeda(totais?.total_fechado) + '</div><div class="kpi-sub">negociado</div></div>' +
      '<div class="kpi-card" style="background:#f0fdf4;border-top-color:#16a34a"><div class="kpi-label">Economia (Venda → Fechado)</div><div class="kpi-value" style="font-size:15px;color:#16a34a">' + Fmt.moeda(economiaTotalVF) + '</div><div class="kpi-sub">markup médio: <strong>' + mkMedio + 'x</strong></div></div>' +
      '</div>' +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">' +

      // ── Economia por mês ───────────────────────────────────────────────────
      '<div class="card">' +
      '<div class="card-header"><div class="card-title">📅 Economia por Mês</div><div class="card-subtitle">Últimos 12 meses</div></div>' +
      (porMes.length ? this.renderBarChart(porMes) : '<div class="empty-state"><p>Sem dados com valor fechado</p></div>') +
      '</div>' +

      // ── Por fornecedor ─────────────────────────────────────────────────────
      '<div class="card">' +
      '<div class="card-header"><div class="card-title">🏭 Economia por Fornecedor</div></div>' +
      (porFornecedor.length ?
        '<div class="table-wrap"><table>' +
        '<thead><tr><th>Fornecedor</th><th>Peças</th><th>Venda</th><th>Fechado</th><th>Economia</th><th>Markup</th></tr></thead>' +
        '<tbody>' + porFornecedor.map(f => {
          const eco = (f.total_venda||0) - (f.total_fechado||0);
          const mk  = f.markup_medio ? f.markup_medio.toFixed(2)+'x' : '—';
          return '<tr>' +
            '<td><strong>' + f.fornecedor + '</strong></td>' +
            '<td style="text-align:center">' + f.total_pecas + '</td>' +
            '<td>' + Fmt.moeda(f.total_venda) + '</td>' +
            '<td>' + Fmt.moeda(f.total_fechado) + '</td>' +
            '<td style="color:#16a34a;font-weight:600">' + Fmt.moeda(eco) + '</td>' +
            '<td><span style="background:#f0fdf4;color:#16a34a;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">' + mk + '</span></td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>'
        : '<div class="empty-state"><p>Sem dados</p></div>') +
      '</div>' +

      '</div>' +

      // ── Top Economias ──────────────────────────────────────────────────────
      '<div class="card">' +
      '<div class="card-header"><div class="card-title">🏆 Top 15 — Maiores Economias por Peça</div>' +
      '<div class="card-subtitle">Diferença entre Preço de Venda e Valor Fechado</div></div>' +
      (topEconomia.length ?
        '<div class="table-wrap"><table>' +
        '<thead><tr><th>Peça</th><th>O.S.</th><th>Cliente</th><th>Fornecedor</th><th>Qtd</th><th>Venda Unit.</th><th>Fechado Unit.</th><th>Markup</th><th>Economia Total</th></tr></thead>' +
        '<tbody>' + topEconomia.map((p, i) =>
          '<tr>' +
          '<td><span style="background:var(--surface-2);color:var(--text-3);padding:1px 6px;border-radius:4px;font-size:10px;margin-right:6px">' + (i+1) + '</span>' +
          (p.codigo ? '<code style="font-size:10px;margin-right:4px">' + p.codigo + '</code>' : '') +
          p.descricao + '</td>' +
          '<td><strong>' + p.numero_os + '</strong></td>' +
          '<td style="font-size:11px;color:var(--text-3)">' + p.cliente + '</td>' +
          '<td style="font-size:11px">' + p.fornecedor + '</td>' +
          '<td style="text-align:center">' + p.quantidade + '</td>' +
          '<td>' + Fmt.moeda(p.preco_unitario) + '</td>' +
          '<td>' + Fmt.moeda(p.preco_fechado) + '</td>' +
          '<td><span style="background:#f0fdf4;color:#16a34a;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700">' + p.markup + 'x</span></td>' +
          '<td style="color:#16a34a;font-weight:700">' + Fmt.moeda(p.economia_total) + '</td>' +
          '</tr>'
        ).join('') +
        '</tbody></table></div>'
        : '<div class="empty-state"><p>Sem dados de economia disponíveis. Preencha o Valor Fechado nas peças.</p></div>') +
      '</div>';
  },

  renderBarChart(porMes) {
    if (!porMes.length) return '';
    const maxVal = Math.max(...porMes.map(m => m.total_fechado||0));
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    return '<div style="display:flex;align-items:flex-end;gap:6px;height:120px;padding:8px 0 0">' +
      porMes.map(m => {
        const pct   = maxVal > 0 ? Math.max(4, Math.round((m.total_fechado/maxVal)*100)) : 4;
        const label = meses[parseInt(m.mes.split('-')[1])-1] + '/' + m.mes.split('-')[0].slice(2);
        const eco   = (m.total_venda||0) - (m.total_fechado||0);
        return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px" title="' +
          label + ': Fechado ' + Fmt.moeda(m.total_fechado) + ' | Economia ' + Fmt.moeda(eco) + '">' +
          '<div style="font-size:9px;color:var(--text-4);font-weight:600">' + Fmt.moeda(m.total_fechado).replace('R$','').trim() + '</div>' +
          '<div style="width:100%;background:#4ade80;border-radius:3px 3px 0 0;height:' + pct + '%;min-height:4px;transition:height .3s"></div>' +
          '<div style="font-size:9px;color:var(--text-4);white-space:nowrap">' + label + '</div>' +
          '</div>';
      }).join('') +
      '</div>';
  },

  async exportarExcel() {
    if (!this.dados) { App.toast('Carregue os relatórios primeiro','error'); return; }
    try {
      const XLSX = await import('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js').catch(() => null);
      // Fallback: exportar como CSV
      this.exportarCSV();
    } catch(e) {
      this.exportarCSV();
    }
  },

  exportarCSV() {
    const { porFornecedor, topEconomia } = this.dados;
    let csv = 'RELATÓRIO DE ECONOMIA — BRU Compressores\n';
    csv += 'Gerado em: ' + new Date().toLocaleDateString('pt-BR') + '\n\n';

    csv += 'POR FORNECEDOR\n';
    csv += 'Fornecedor,Peças,Total Venda,Total Fechado,Economia,Markup Médio\n';
    porFornecedor.forEach(f => {
      const eco = (f.total_venda||0) - (f.total_fechado||0);
      csv += '"' + f.fornecedor + '",' + f.total_pecas + ',' +
        (f.total_venda||0).toFixed(2) + ',' + (f.total_fechado||0).toFixed(2) + ',' +
        eco.toFixed(2) + ',' + (f.markup_medio||0).toFixed(2) + '\n';
    });

    csv += '\nTOP ECONOMIAS POR PEÇA\n';
    csv += 'Peça,Código,O.S.,Cliente,Fornecedor,Qtd,Preço Venda,Valor Fechado,Markup,Economia\n';
    topEconomia.forEach(p => {
      csv += '"' + p.descricao + '","' + (p.codigo||'') + '","' + p.numero_os + '","' +
        p.cliente + '","' + p.fornecedor + '",' + p.quantidade + ',' +
        p.preco_unitario.toFixed(2) + ',' + p.preco_fechado.toFixed(2) + ',' +
        p.markup + ',' + p.economia_total.toFixed(2) + '\n';
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'relatorio-economia-' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    App.toast('Relatório exportado!', 'success');
  }
};
