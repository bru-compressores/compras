const PageBackup = {
  render() {
    document.getElementById('topbar-actions').innerHTML =
      '<button class="btn btn-secondary btn-sm" onclick="App.navigate(\'dashboard\')">← Dashboard</button>';

    document.getElementById('content').innerHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:760px">' +

      // Exportar
      '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">⬇ Exportar Backup</div>' +
      '<div class="card-subtitle">Salva todos os dados do sistema</div></div></div>' +
      '<p style="font-size:12px;color:var(--text-2);margin-bottom:14px">Exporta O.S., peças, fornecedores e histórico em formato JSON.</p>' +
      '<button class="btn btn-primary w-full" style="justify-content:center" onclick="PageBackup.exportar()">⬇ Baixar backup JSON</button>' +
      '<div style="margin-top:10px;padding:10px;background:var(--success-bg);border-radius:var(--radius);font-size:11px;color:var(--success)">✅ Inclui: O.S. + peças + fornecedores + histórico</div>' +
      '</div>' +

      // Restaurar
      '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">⬆ Restaurar Backup</div>' +
      '<div class="card-subtitle">Importar dados de backup anterior</div></div></div>' +
      '<div style="background:var(--surface-2);border:2px dashed var(--border);border-radius:var(--radius-lg);padding:16px;text-align:center;margin-bottom:10px">' +
      '<input type="file" id="backup-file" accept=".json" style="display:none" onchange="PageBackup.arquivoSelecionado(this)">' +
      '<button class="btn btn-secondary" onclick="document.getElementById(\'backup-file\').click()">Selecionar arquivo .json</button>' +
      '<p style="font-size:11px;color:var(--text-4);margin-top:6px" id="backup-nome">Nenhum arquivo</p></div>' +
      '<div id="backup-resultado" style="margin-bottom:10px"></div>' +
      '<button class="btn btn-orange w-full" style="justify-content:center" id="btn-restaurar" onclick="PageBackup.restaurar()" disabled>⬆ Restaurar dados</button>' +
      '<div style="margin-top:10px;padding:10px;background:var(--warning-bg);border-radius:var(--radius);font-size:11px;color:var(--warning)">⚠️ Adiciona dados sem apagar os existentes</div>' +
      '</div>' +

      '</div>';
  },

  async exportar() {
    try {
      const resp = await fetch('/api/backup/exportar-json', { headers: { 'Authorization': 'Bearer ' + Api.token } });
      if (!resp.ok) throw new Error('Erro ao exportar');
      const blob = await resp.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'backup-compras-' + new Date().toISOString().split('T')[0] + '.json';
      a.click(); URL.revokeObjectURL(url);
      App.toast('Backup exportado!', 'success');
    } catch(e) { App.toast(e.message, 'error'); }
  },

  arquivoSelecionado(input) {
    if (input.files[0]) {
      document.getElementById('backup-nome').textContent = input.files[0].name;
      document.getElementById('btn-restaurar').disabled = false;
    }
  },

  async restaurar() {
    const file = document.getElementById('backup-file').files[0]; if (!file) return;
    if (!App.confirm('Confirma a restauração? Os dados do backup serão adicionados ao banco atual. O processamento roda em segundo plano e pode levar alguns minutos.')) return;
    document.getElementById('backup-resultado').innerHTML = '<div class="alert alert-warning">Enviando arquivo…</div>';
    document.getElementById('btn-restaurar').disabled = true;
    try {
      const text  = await file.text();
      const dados = JSON.parse(text);
      const totalRegistros = (dados.ordens_servico?.length||0) + (dados.pecas_os?.length||0) + (dados.fornecedores?.length||0);

      const resp = await fetch('/api/backup/restaurar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Api.token },
        body: JSON.stringify(dados)
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.erro || 'Erro ao iniciar restauração');

      document.getElementById('backup-resultado').innerHTML =
        '<div class="alert alert-success">✅ ' + data.mensagem + '</div>' +
        '<div style="margin-top:8px;font-size:11px;color:var(--text-3)">Total no arquivo: ' + totalRegistros + ' registros. ' +
        '<button class="btn btn-secondary btn-sm" style="margin-left:6px" onclick="PageBackup.verificarStatus()">Verificar progresso</button></div>';
      App.toast('Restauração iniciada em segundo plano!', 'success');
    } catch(e) {
      document.getElementById('backup-resultado').innerHTML = '<div class="alert alert-danger">❌ ' + e.message + '</div>';
    }
    document.getElementById('btn-restaurar').disabled = false;
  },

  async verificarStatus() {
    try {
      const status = await Api.get('/backup/status');
      document.getElementById('backup-resultado').innerHTML +=
        '<div style="margin-top:8px;padding:10px;background:var(--surface-2);border-radius:var(--radius);font-size:12px">' +
        '📊 No banco agora: <strong>' + status.ordens_servico + '</strong> O.S. · ' +
        '<strong>' + status.pecas_os + '</strong> peças · ' +
        '<strong>' + status.fornecedores + '</strong> fornecedores</div>';
    } catch(e) { App.toast(e.message, 'error'); }
  }
};
