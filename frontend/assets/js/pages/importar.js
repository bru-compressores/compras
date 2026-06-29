const PageImportar = {
  arquivos: [],

  render() {
    document.getElementById('topbar-actions').innerHTML =
      '<button class="btn btn-secondary btn-sm" onclick="App.navigate(\'dashboard\')">← Dashboard</button>';

    document.getElementById('content').innerHTML =
      '<div style="display:flex;flex-direction:column;gap:16px;max-width:900px">' +

      // ── PDF Primam ────────────────────────────────────────────────────────
      '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">📄 Importar O.S. via PDF — Primam</div>' +
      '<div class="card-subtitle">Arraste os PDFs exportados do Primam. Peças extraídas automaticamente.</div></div></div>' +
      '<div id="dropzone" style="border:2px dashed var(--border);border-radius:var(--radius-lg);padding:28px;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:14px"' +
      ' onclick="document.getElementById(\'pdf-input\').click()"' +
      ' ondragover="event.preventDefault();this.style.borderColor=\'var(--brand2)\';this.style.background=\'var(--brand-light)\'"' +
      ' ondragleave="this.style.borderColor=\'var(--border)\';this.style.background=\'\'"' +
      ' ondrop="PageImportar.onDrop(event)">' +
      '<div style="font-size:32px;margin-bottom:6px">📄</div>' +
      '<div style="font-size:13px;font-weight:600;color:var(--text-2)">Arraste os PDFs aqui ou clique para selecionar</div>' +
      '<div style="font-size:11px;color:var(--text-4);margin-top:3px">Vários arquivos de uma vez — máx. 50 por lote</div>' +
      '<input type="file" id="pdf-input" accept=".pdf" multiple style="display:none" onchange="PageImportar.onFileSelect(this.files)"></div>' +
      '<div id="lista-arquivos" style="margin-bottom:12px"></div>' +
      '<div style="display:flex;align-items:center;gap:10px">' +
      '<button class="btn btn-orange" id="btn-importar" onclick="PageImportar.importar()" disabled>Importar PDFs</button>' +
      '<button class="btn btn-secondary" onclick="PageImportar.limpar()">Limpar</button>' +
      '<span id="import-status" style="font-size:12px;color:var(--text-3)"></span></div>' +
      '<div id="import-resultado" style="margin-top:12px"></div>' +
      '</div>' +

      // ── Fornecedores Excel ────────────────────────────────────────────────
      '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">🏭 Importar Fornecedores — Excel</div>' +
      '<div class="card-subtitle">Planilha exportada do ERP Primam</div></div></div>' +
      '<p style="font-size:12px;color:var(--text-2);margin-bottom:14px">' +
      'Selecione o relatório de fornecedores <code style="background:var(--surface-3);padding:1px 6px;border-radius:4px">.xls</code> ou <code style="background:var(--surface-3);padding:1px 6px;border-radius:4px">.xlsx</code> exportado do Primam.' +
      '</p>' +
      '<div style="background:var(--surface-2);border:2px dashed var(--border);border-radius:var(--radius-lg);padding:24px;text-align:center;margin-bottom:14px">' +
      '<div style="font-size:28px;margin-bottom:8px">📊</div>' +
      '<input type="file" id="excel-file" accept=".xls,.xlsx" style="display:none" onchange="PageImportar.excelSelecionado(this)">' +
      '<button class="btn btn-secondary" onclick="document.getElementById(\'excel-file\').click()">Selecionar planilha Excel</button>' +
      '<p style="font-size:11px;color:var(--text-4);margin-top:8px" id="excel-nome">Nenhum arquivo selecionado</p>' +
      '</div>' +
      '<div style="margin-bottom:14px">' +
      '<div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Colunas reconhecidas automaticamente</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:5px">' +
      ['Razão Social / Nome','CNPJ / CPF','Telefone','Cidade','UF','E-mail','Nome Fantasia'].map(c =>
        '<code style="font-size:11px;background:var(--surface-3);padding:2px 7px;border-radius:4px;color:var(--text-2)">' + c + '</code>'
      ).join('') +
      '</div></div>' +
      '<div id="excel-resultado" style="margin-bottom:12px"></div>' +
      '<button class="btn btn-primary" id="btn-excel" onclick="PageImportar.importarExcel()" disabled>Importar Fornecedores</button>' +
      '</div>' +

      '</div>';
  },

  onDrop(e) {
    e.preventDefault();
    e.currentTarget.style.borderColor = 'var(--border)';
    e.currentTarget.style.background  = '';
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (!files.length) { App.toast('Apenas PDFs são aceitos','error'); return; }
    this.adicionarArquivos(files);
  },
  onFileSelect(files) { this.adicionarArquivos(Array.from(files)); },
  adicionarArquivos(files) { this.arquivos = [...this.arquivos, ...files]; this.renderLista(); },
  renderLista() {
    const el = document.getElementById('lista-arquivos');
    if (!this.arquivos.length) { el.innerHTML=''; document.getElementById('btn-importar').disabled=true; return; }
    el.innerHTML =
      '<div style="font-size:11px;font-weight:600;color:var(--text-3);margin-bottom:6px">' + this.arquivos.length + ' arquivo(s) selecionado(s)</div>' +
      '<div style="display:flex;flex-direction:column;gap:4px;max-height:160px;overflow-y:auto">' +
      this.arquivos.map((f,i) =>
        '<div style="display:flex;align-items:center;gap:8px;padding:5px 10px;background:var(--surface-2);border-radius:var(--radius);font-size:12px">' +
        '<span style="color:var(--danger)">📄</span>' +
        '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + f.name + '</span>' +
        '<span style="color:var(--text-4)">' + Math.round(f.size/1024) + ' KB</span>' +
        '<button class="btn-icon" style="font-size:11px" onclick="PageImportar.remover(' + i + ')">✕</button></div>'
      ).join('') + '</div>';
    document.getElementById('btn-importar').disabled = false;
  },
  remover(i) { this.arquivos.splice(i,1); this.renderLista(); },
  limpar() {
    this.arquivos = []; this.renderLista();
    document.getElementById('import-resultado').innerHTML = '';
    document.getElementById('pdf-input').value = '';
  },

  async importar() {
    if (!this.arquivos.length) return;
    const btn = document.getElementById('btn-importar');
    btn.disabled = true; btn.textContent = 'Importando…';
    document.getElementById('import-status').textContent = 'Processando ' + this.arquivos.length + ' arquivo(s)…';
    const fd = new FormData();
    this.arquivos.forEach(f => fd.append('arquivos', f));
    try {
      const resp = await fetch('/api/importar-pdf', { method:'POST', headers:{'Authorization':'Bearer '+Api.token}, body:fd });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.erro || 'Erro');
      const ok  = data.resultados.filter(r => r.sucesso);
      const err = data.resultados.filter(r => !r.sucesso);
      const totalP = ok.reduce((s,r) => s + r.pecas_importadas, 0);
      document.getElementById('import-resultado').innerHTML =
        (ok.length  ? '<div class="alert alert-success" style="margin-bottom:6px">✅ ' + ok.length + ' O.S. — ' + totalP + ' peças adicionadas</div>' : '') +
        (err.length ? '<div class="alert alert-danger">' + err.map(r => r.arquivo + ': ' + r.erro).join('<br>') + '</div>' : '') +
        (ok.length  ? '<button class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="App.navigate(\'ordens\')">Ver O.S. →</button>' : '');
      this.arquivos = []; this.renderLista();
    } catch(e) {
      document.getElementById('import-resultado').innerHTML = '<div class="alert alert-danger">❌ ' + e.message + '</div>';
    }
    btn.disabled = false; btn.textContent = 'Importar PDFs';
    document.getElementById('import-status').textContent = '';
  },

  excelSelecionado(input) {
    if (input.files[0]) {
      document.getElementById('excel-nome').textContent = input.files[0].name;
      document.getElementById('btn-excel').disabled = false;
    }
  },

  async importarExcel() {
    const file = document.getElementById('excel-file').files[0];
    if (!file) return;
    document.getElementById('excel-resultado').innerHTML = '<div class="alert alert-warning">Importando, aguarde…</div>';
    document.getElementById('btn-excel').disabled = true;
    try {
      const fd = new FormData();
      fd.append('arquivo', file);
      const resp = await fetch('/api/backup/importar-fornecedores-excel', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + Api.token },
        body: fd
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.erro || 'Erro ao importar');
      document.getElementById('excel-resultado').innerHTML =
        '<div class="alert alert-success">✅ ' + data.mensagem +
        (data.erros?.length ? '<br><small>⚠️ ' + data.erros.join(', ') + '</small>' : '') + '</div>';
      App.toast('Fornecedores importados!', 'success');
    } catch(e) {
      document.getElementById('excel-resultado').innerHTML = '<div class="alert alert-danger">❌ ' + e.message + '</div>';
    }
    document.getElementById('btn-excel').disabled = false;
  }
};
