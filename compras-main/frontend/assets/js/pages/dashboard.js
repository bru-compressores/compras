const PageDashboard = {
  async render() {
    document.getElementById('topbar-actions').innerHTML =
      '<button class="btn btn-secondary btn-sm" onclick="App.navigate(\'configuracoes\')" title="Configurar dashboard">⚙ Configurar Dashboard</button>';

    document.getElementById('content').innerHTML = '<div class="empty-state"><p>Carregando…</p></div>';
    try {
      const [d, cfg] = await Promise.all([
        Api.get('/dashboard'),
        Api.get('/configuracoes').catch(() => ({}))
      ]);

      const ocultos   = JSON.parse(cfg.dashboard_ocultos || '[]');
      const ordem     = JSON.parse(cfg.dashboard_ordem   || '[]');
      const mkVerde   = parseFloat(cfg.markup_verde   || 2.2);
      const mkLaranja = parseFloat(cfg.markup_laranja || 2.0);

      const statusMap = { 'Aberta':0,'Aguardando peças':0,'Peças separadas':0,'Concluída':0 };
      d.por_status.forEach(s => statusMap[s.status] = s.total);
      const totalOS = Object.values(statusMap).reduce((a,b) => a+b, 0);

      const mkMedio = d.markup_medio || null;
      const mkSinal = mkMedio
        ? mkMedio >= mkVerde   ? { cor:'#15803d', bg:'#dcfce7', label:'🟢' }
        : mkMedio >= mkLaranja ? { cor:'#d97706', bg:'#fef3c7', label:'🟡' }
        :                        { cor:'#dc2626', bg:'#fee2e2', label:'🔴' }
        : null;

      const todosKpis = {
        total_os:     { klass:'info',    label:'Total de O.S.',      val:totalOS,                          sub:(statusMap['Aberta']||0)+' abertas' },
        aguardando:   { klass:'warning', label:'Aguardando peças',   val:statusMap['Aguardando peças']||0, sub:'ordens em espera' },
        atrasadas:    { klass:d.os_atrasadas>0?'danger':'success',   label:'O.S. atrasadas', val:d.os_atrasadas, sub:'prazo vencido' },
        transito:     { klass:'warning', label:'Em trânsito',        val:d.em_transito,                    sub:'peças a caminho' },
        pendentes:    { klass:'orange',  label:'Entregas pendentes', val:d.entregas_pendentes,             sub:'não entregues' },
        concluidas:   { klass:'success', label:'Concluídas',         val:statusMap['Concluída']||0,        sub:'este período' },
        valor_aberto: { klass:'',        label:'Valor em aberto',    val:Fmt.moeda(d.valor_total_aberto),  sub:'O.S. não concluídas', txt:true },
        markup_medio: { klass:'', label:'Markup Médio',
          val: mkSinal ? mkSinal.label+' '+(mkMedio||0).toFixed(2)+'x' : '—',
          sub: mkSinal ? 'venda/fechado' : 'sem dados',
          txt:true, cor:mkSinal?.cor, bg:mkSinal?.bg },
      };

      const allKeys = Object.keys(todosKpis);
      const keysOrdenados = ordem.length
        ? [...ordem.filter(k => allKeys.includes(k)), ...allKeys.filter(k => !ordem.includes(k))]
        : allKeys;
      const kpisVisiveis = keysOrdenados.filter(k => !ocultos.includes(k));

      const atrasadas  = d.pecas_atrasadas || [];
      const vencendo   = d.os_vencendo     || [];

      document.getElementById('content').innerHTML =

        // ── KPIs ───────────────────────────────────────────────────────────
        '<div class="kpi-grid mb-14">' +
        kpisVisiveis.map(key => {
          const k = todosKpis[key];
          return '<div class="kpi-card ' + k.klass + '"' +
            (k.bg ? ' style="background:' + k.bg + ';border-top-color:' + k.cor + '"' : '') + '>' +
            '<div class="kpi-label">' + k.label + '</div>' +
            '<div class="kpi-value"' + (k.txt ? ' style="font-size:16px' + (k.cor?';color:'+k.cor:'') + '"' : '') + '>' + k.val + '</div>' +
            '<div class="kpi-sub">' + k.sub + '</div></div>';
        }).join('') +
        '</div>' +

        // ── Alertas (só mostra se tiver algo) ──────────────────────────────
        (atrasadas.length || vencendo.length ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">' : '') +

        // Peças atrasadas
        (atrasadas.length ? '<div class="card" style="border-top:3px solid #dc2626">' +
          '<div class="card-header"><div><div class="card-title" style="color:#dc2626">🔴 Peças com entrega atrasada</div>' +
          '<div class="card-subtitle">' + atrasadas.length + ' peça(s) com prazo vencido</div></div></div>' +
          '<div style="display:flex;flex-direction:column;gap:6px">' +
          atrasadas.map(p =>
            '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface-2);border-radius:var(--radius);cursor:pointer" onclick="App.navigate(\'detalhe-os\',{id:' + p.os_id + '})">' +
            '<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap">+' + p.dias_atraso + ' dias</span>' +
            '<div style="flex:1;min-width:0">' +
            '<div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + p.descricao + '</div>' +
            '<div style="font-size:11px;color:var(--text-3)">OS ' + p.numero_os + ' — ' + p.cliente + '</div>' +
            '</div>' +
            Fmt.prioridade(p.prioridade) +
            '</div>'
          ).join('') +
          '</div></div>' : '') +

        // O.S. vencendo em breve
        (vencendo.length ? '<div class="card" style="border-top:3px solid #d97706">' +
          '<div class="card-header"><div><div class="card-title" style="color:#d97706">🟡 O.S. com prazo próximo</div>' +
          '<div class="card-subtitle">Vencendo nos próximos 7 dias</div></div></div>' +
          '<div style="display:flex;flex-direction:column;gap:6px">' +
          vencendo.map(os =>
            '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface-2);border-radius:var(--radius);cursor:pointer" onclick="App.navigate(\'detalhe-os\',{id:' + os.id + '})">' +
            Fmt.semaforoPrazo(os.data_conclusao_estimada) +
            '<div style="flex:1;min-width:0">' +
            '<div style="font-size:12px;font-weight:600">OS ' + os.numero_os + '</div>' +
            '<div style="font-size:11px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + os.cliente + '</div>' +
            '</div>' +
            Fmt.prioridade(os.prioridade) + Fmt.statusOS(os.status) +
            '</div>'
          ).join('') +
          '</div></div>' : '') +

        (atrasadas.length || vencendo.length ? '</div>' : '') +

        // ── Grid principal ─────────────────────────────────────────────────
        '<div class="grid-2">' +
        '<div class="card">' +
        '<div class="card-header"><div class="card-title">Status das O.S.</div></div>' +
        [['Aberta','#9ca3af'],['Aguardando peças','#d97706'],['Peças separadas','#1a56db'],['Concluída','#059669']].map(([s,c]) => {
          const n = statusMap[s]||0, pct = totalOS>0 ? Math.round(n/totalOS*100) : 0;
          return '<div style="margin-bottom:10px">' +
            '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-2);margin-bottom:4px"><span>' + s + '</span><span style="font-weight:600">' + n + '</span></div>' +
            '<div style="height:5px;background:var(--surface-3);border-radius:3px"><div style="height:100%;background:' + c + ';border-radius:3px;width:' + pct + '%"></div></div></div>';
        }).join('') +
        '</div>' +
        '<div class="card">' +
        '<div class="card-header"><div class="card-title">Atividade recente</div>' +
        '<button class="btn btn-secondary btn-sm" onclick="App.navigate(\'ordens\')">Ver todas</button></div>' +
        (d.recentes||[]).map(os => {
          const pc = os.total_pecas||0, ent = os.pecas_entregues||0;
          return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="App.navigate(\'detalhe-os\',{id:' + os.id + '})">' +
            '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600">' + os.numero_os + '</div>' +
            '<div style="font-size:11px;color:var(--text-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + os.cliente + '</div></div>' +
            Fmt.statusOS(os.status) +
            '<div style="display:flex;align-items:center;gap:5px"><div class="progress-bar" style="width:44px"><div class="progress-fill ' + (pc>0&&ent===pc?'success':'') + '" style="width:' + (pc>0?Math.round(ent/pc*100):0) + '%"></div></div>' +
            '<span style="font-size:10px;color:var(--text-3)">' + ent + '/' + pc + '</span></div></div>';
        }).join('') +
        '</div></div>';

    } catch(e) {
      document.getElementById('content').innerHTML = '<div class="alert alert-danger">' + e.message + '</div>';
    }
  }
};
