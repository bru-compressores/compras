const API_BASE = '/api';

const Api = {
  token: null,

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  },

  async req(method, path, body) {
    const opts = { method, headers: this.headers() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API_BASE + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'Erro na requisição');
    return data;
  },

  get:    (p)    => Api.req('GET',    p),
  post:   (p, b) => Api.req('POST',   p, b),
  put:    (p, b) => Api.req('PUT',    p, b),
  delete: (p)    => Api.req('DELETE', p),

  async uploadCSV(file) {
    const fd = new FormData();
    fd.append('arquivo', file);
    const res = await fetch(API_BASE + '/importar-csv', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` },
      body: fd
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'Erro no upload');
    return data;
  }
};

// Helpers de formatação compartilhados
const Fmt = {
  data(s) {
    if (!s) return '-';
    const [y, m, d] = s.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  },
  moeda(v) {
    if (v == null) return '-';
    return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  },
  statusOS(s) {
    const map = {
      'Aberta': 'badge-aberta',
      'Aguardando peças': 'badge-aguardando',
      'Peças separadas': 'badge-separadas',
      'Concluída': 'badge-concluida'
    };
    return `<span class="badge ${map[s] || 'badge-aberta'}">${s}</span>`;
  },
  prioridade(p) {
    return p === 'Alta'
      ? `<span class="badge badge-alta">▲ Alta</span>`
      : `<span class="badge badge-media">Média</span>`;
  },
  // Semáforo de prazo baseado em dias restantes
  semaforoPrazo(dataStr) {
    if (!dataStr) return '';
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const data = new Date(dataStr + 'T00:00:00');
    const dias = Math.round((data - hoje) / (1000*60*60*24));
    if (dias < 0)       return '<span title="Atrasado ' + Math.abs(dias) + ' dia(s)" style="display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700;background:#fee2e2;color:#dc2626">🔴 ' + Math.abs(dias) + 'd atraso</span>';
    if (dias === 0)     return '<span title="Vence hoje!" style="display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700;background:#fef3c7;color:#d97706">🟡 Hoje</span>';
    if (dias <= 3)      return '<span title="Vence em ' + dias + ' dia(s)" style="display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700;background:#fef3c7;color:#d97706">🟡 ' + dias + 'd</span>';
    if (dias <= 7)      return '<span title="Vence em ' + dias + ' dia(s)" style="display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700;background:#f0fdf4;color:#16a34a">🟢 ' + dias + 'd</span>';
    return '<span style="font-size:11px;color:var(--text-4)">' + Fmt.data(dataStr) + '</span>';
  },

  statusEntrega(s) {
    const map = {
      'Pendente': 'badge-pendente',
      'Pedido realizado': 'badge-pedido',
      'Em trânsito': 'badge-transito',
      'Entregue': 'badge-entregue',
      'Cancelado': 'badge-cancelado'
    };
    return `<span class="badge ${map[s] || 'badge-pendente'}">${s}</span>`;
  }
};

// ─── Componente Autocomplete de Fornecedor ────────────────────────────────
const FornecedorAutocomplete = {
  _cache: null,

  async getFornecedores() {
    if (!this._cache) {
      this._cache = await Api.get('/fornecedores');
    }
    return this._cache;
  },

  invalidar() { this._cache = null; },

  // Renderiza o HTML do componente
  // inputId: id do input de busca
  // hiddenId: id do input hidden com o valor (fornecedor_id)
  // valorInicial: { id, nome } opcional
  html(inputId, hiddenId, valorInicial) {
    const nome = valorInicial?.nome || '';
    const id   = valorInicial?.id   || '';
    return '<div class="autocomplete-wrap">' +
      '<input type="text" id="' + inputId + '" class="form-input autocomplete-input"' +
      ' placeholder="Digite para buscar fornecedor…"' +
      ' value="' + nome + '"' +
      ' autocomplete="off"' +
      ' oninput="FornecedorAutocomplete.buscar(this, \'' + hiddenId + '\')"' +
      ' onkeydown="FornecedorAutocomplete.navegar(event, \'' + hiddenId + '\')"' +
      ' onblur="FornecedorAutocomplete.fechar()">' +
      (nome ? '<button class="autocomplete-clear" onclick="FornecedorAutocomplete.limpar(\'' + inputId + '\',\'' + hiddenId + '\')" tabindex="-1">✕</button>' : '') +
      '<input type="hidden" id="' + hiddenId + '" value="' + id + '">' +
      '<div class="autocomplete-list" id="' + inputId + '-list" style="display:none"></div>' +
      '</div>';
  },

  async buscar(input, hiddenId) {
    const termo = input.value.toLowerCase().trim();
    const listEl = document.getElementById(input.id + '-list');
    document.getElementById(hiddenId).value = '';

    if (!termo) { listEl.style.display = 'none'; return; }

    const todos = await this.getFornecedores();
    const filtrados = todos.filter(f =>
      f.nome.toLowerCase().includes(termo) ||
      (f.cnpj||'').includes(termo) ||
      (f.cidade||'').toLowerCase().includes(termo)
    ).slice(0, 12);

    if (!filtrados.length) {
      listEl.innerHTML = '<div class="autocomplete-item" style="color:var(--text-4)">Nenhum fornecedor encontrado</div>';
      listEl.style.display = 'block';
      return;
    }

    listEl.innerHTML = filtrados.map(f =>
      '<div class="autocomplete-item" data-id="' + f.id + '" data-nome="' + f.nome + '"' +
      ' onmousedown="FornecedorAutocomplete.selecionar(event, \'' + input.id + '\', \'' + hiddenId + '\')">' +
      f.nome +
      (f.cidade ? '<small>' + f.cidade + (f.estado ? '/' + f.estado : '') + (f.cnpj ? ' — ' + f.cnpj : '') + '</small>' : '') +
      '</div>'
    ).join('');
    listEl.style.display = 'block';
  },

  selecionar(e, inputId, hiddenId) {
    const item = e.currentTarget;
    document.getElementById(inputId).value  = item.dataset.nome;
    document.getElementById(hiddenId).value = item.dataset.id;
    document.getElementById(inputId + '-list').style.display = 'none';
    // Adiciona botão limpar
    const wrap = document.getElementById(inputId).parentElement;
    let btn = wrap.querySelector('.autocomplete-clear');
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'autocomplete-clear';
      btn.tabIndex = -1;
      btn.textContent = '✕';
      btn.onclick = () => FornecedorAutocomplete.limpar(inputId, hiddenId);
      wrap.appendChild(btn);
    }
    btn.style.display = '';
  },

  navegar(e, hiddenId) {
    const listEl = document.getElementById(e.target.id + '-list');
    const items  = listEl.querySelectorAll('.autocomplete-item[data-id]');
    if (!items.length) return;
    const current = listEl.querySelector('.selected');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = current ? current.nextElementSibling : items[0];
      if (current) current.classList.remove('selected');
      if (next) next.classList.add('selected');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = current ? current.previousElementSibling : items[items.length-1];
      if (current) current.classList.remove('selected');
      if (prev) prev.classList.add('selected');
    } else if (e.key === 'Enter' && current) {
      e.preventDefault();
      document.getElementById(e.target.id).value  = current.dataset.nome;
      document.getElementById(hiddenId).value = current.dataset.id;
      listEl.style.display = 'none';
    } else if (e.key === 'Escape') {
      listEl.style.display = 'none';
    }
  },

  fechar() {
    setTimeout(() => {
      document.querySelectorAll('.autocomplete-list').forEach(l => l.style.display = 'none');
    }, 150);
  },

  limpar(inputId, hiddenId) {
    document.getElementById(inputId).value  = '';
    document.getElementById(hiddenId).value = '';
    document.getElementById(inputId + '-list').style.display = 'none';
    const btn = document.getElementById(inputId)?.parentElement?.querySelector('.autocomplete-clear');
    if (btn) btn.style.display = 'none';
  }
};

// ─── Utilitário de ordenação de tabelas ──────────────────────────────────
const TableSort = {
  _estado: {}, // { tableId: { col, dir } }

  // Inicializa os headers de uma tabela como clicáveis
  // tableId: id da tabela (ou prefixo único)
  // cols: array de { key, label, tipo } onde tipo = 'str' | 'num' | 'date'
  // dados: array de objetos
  // renderFn: função(dados) que retorna HTML das linhas <tr>...</tr>
  // tbodySelector: seletor do tbody onde inserir
  init(tableId, cols, dados, renderFn, tbodySelector) {
    this._estado[tableId] = this._estado[tableId] || { col: null, dir: 'asc' };
    const estado = this._estado[tableId];

    const headers = cols.map(c => {
      const isAtivo = estado.col === c.key;
      const dir = isAtivo ? estado.dir : '';
      return '<th class="sortable ' + dir + '" data-key="' + c.key + '" data-tipo="' + (c.tipo||'str') + '" onclick="TableSort.ordenar(\'' + tableId + '\',\'' + c.key + '\',\'' + (c.tipo||'str') + '\')">' +
        c.label + '<span class="sort-icon"></span></th>';
    }).join('');

    const dadosOrdenados = this.ordenarDados(dados, estado.col, estado.dir, cols);
    return { headers, dadosOrdenados };
  },

  ordenarDados(dados, col, dir, cols) {
    if (!col) return dados;
    const colDef = cols ? cols.find(c => c.key === col) : null;
    const tipo = colDef?.tipo || 'str';
    return [...dados].sort((a, b) => {
      let va = a[col], vb = b[col];
      if (va == null) va = ''; if (vb == null) vb = '';
      let cmp;
      if (tipo === 'num') {
        cmp = (parseFloat(va)||0) - (parseFloat(vb)||0);
      } else if (tipo === 'date') {
        cmp = new Date(va||0) - new Date(vb||0);
      } else {
        cmp = String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' });
      }
      return dir === 'asc' ? cmp : -cmp;
    });
  },

  // Chamado quando clica no header — re-renderiza a tabela
  ordenar(tableId, col, tipo) {
    const estado = this._estado[tableId] || { col: null, dir: 'asc' };
    if (estado.col === col) {
      estado.dir = estado.dir === 'asc' ? 'desc' : 'asc';
    } else {
      estado.col = col; estado.dir = 'asc';
    }
    this._estado[tableId] = estado;
    // Dispara re-render da página que registrou o callback
    if (this._callbacks[tableId]) this._callbacks[tableId]();
  },

  _callbacks: {},
  registrar(tableId, fn) { this._callbacks[tableId] = fn; },
  reset(tableId) { delete this._estado[tableId]; }
};

// ─── Exportar tabela para Excel/CSV ──────────────────────────────────────
const ExportExcel = {
  // dados: array de objetos, colunas: [{key, label}], nomeArquivo
  exportar(dados, colunas, nomeArquivo) {
    if (!dados.length) { App.toast('Nenhum dado para exportar','error'); return; }
    const cols = colunas || Object.keys(dados[0]).map(k => ({ key: k, label: k }));

    let csv = cols.map(c => '"' + c.label + '"').join(',') + '\n';
    dados.forEach(row => {
      csv += cols.map(c => {
        const v = row[c.key];
        if (v == null) return '""';
        return '"' + String(v).replace(/"/g, '""') + '"';
      }).join(',') + '\n';
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = (nomeArquivo || 'exportacao') + '-' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    App.toast('Exportado com sucesso!', 'success');
  }
};
