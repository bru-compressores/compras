const App = {
  usuario: null, paginaAtual: null,
  historicoNavegacao: [], _lastParams: null,

  breadcrumbs: {
    dashboard:     'BRU Compressores / Dashboard',
    ordens:        'BRU Compressores / O.S. e Pedidos de Peças',
    kanban:        'BRU Compressores / Kanban',
    'detalhe-os':  'BRU Compressores / Detalhe',
    rastreamento:  'BRU Compressores / Rastreamento de Peças',
    fornecedores:  'BRU Compressores / Fornecedores',
    relatorios:    'BRU Compressores / Relatórios',
    importar:      'BRU Compressores / Importar',
    backup:        'BRU Compressores / Backup',
    configuracoes: 'BRU Compressores / Configurações',
  },
  titles: {
    dashboard:     'Dashboard',
    ordens:        'O.S. / Pedidos de Peças',
    kanban:        'Kanban — O.S.',
    'detalhe-os':  'Detalhe',
    rastreamento:  'Rastreamento de Peças',
    fornecedores:  'Fornecedores',
    relatorios:    'Relatórios',
    importar:      'Importar',
    backup:        'Backup',
    configuracoes: 'Configurações',
  },

  getPages() {
    return {
      dashboard:     PageDashboard,
      ordens:        PageOrdens,
      'detalhe-os':  PageDetalheOS,
      rastreamento:  PageRastreamento,
      fornecedores:  PageFornecedores,
      relatorios:    PageRelatorios,
      kanban:        PageKanban,
      triagem:       PageTriagem,
      importar:      PageImportar,
      backup:        PageBackup,
      configuracoes: PageConfiguracoes,
    };
  },

  async login() {
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    const alertEl = document.getElementById('login-alert');
    alertEl.innerHTML = '';
    if (!email || !senha) { alertEl.innerHTML = '<div class="alert alert-danger">Preencha e-mail e senha.</div>'; return; }
    try {
      const data = await Api.post('/auth/login', { email, senha });
      Api.token = data.token; this.usuario = data.usuario;
      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
      this.iniciar();
    } catch(e) { alertEl.innerHTML = '<div class="alert alert-danger">' + e.message + '</div>'; }
  },

  logout() {
    Api.token = null; this.usuario = null;
    localStorage.removeItem('token'); localStorage.removeItem('usuario');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').style.display = 'flex';
  },

  iniciar() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').classList.remove('hidden');
    const nome = this.usuario.nome;
    document.getElementById('sidebar-user-nome').textContent = nome;
    document.getElementById('sidebar-user-papel').textContent = this.usuario.papel === 'admin' ? 'Administrador' : 'Operador';
    document.getElementById('sidebar-avatar').textContent = nome.charAt(0).toUpperCase();
    if (this.usuario.papel !== 'admin') {
      document.querySelectorAll('.nav-admin, #nav-admin-section').forEach(el => el.classList.add('hidden'));
    }
    this.navigate('dashboard');
  },

  navigate(pagina, params) {
    if (this.paginaAtual && this.paginaAtual !== pagina) {
      this.historicoNavegacao.push({ pagina: this.paginaAtual, params: this._lastParams });
      if (this.historicoNavegacao.length > 10) this.historicoNavegacao.shift();
    }
    this._lastParams = params; this.paginaAtual = pagina;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === pagina));
    document.getElementById('topbar-title').textContent = this.titles[pagina] || pagina;
    document.getElementById('topbar-bread').textContent = this.breadcrumbs[pagina] || 'BRU Compressores';
    document.getElementById('topbar-actions').innerHTML = '';
    // Fecha o menu lateral no mobile após navegar
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.remove('open');
      document.body.classList.remove('sidebar-open');
    }
    window.scrollTo(0, 0);
    const page = this.getPages()[pagina];
    if (page) page.render(params);
    else document.getElementById('content').innerHTML = '<div class="empty-state"><p>Página não encontrada</p></div>';
  },

  voltar() {
    if (this.historicoNavegacao.length > 0) {
      const { pagina, params } = this.historicoNavegacao.pop();
      this.navigate(pagina, params);
    } else { this.navigate('dashboard'); }
  },

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
    document.body.classList.toggle('sidebar-open', sidebar.classList.contains('open'));
  },

  toast(msg, tipo = 'default') {
    const t = document.createElement('div');
    t.className = 'toast ' + tipo; t.textContent = msg;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 3200);
  },

  confirm(msg) { return window.confirm(msg); }
};

window.addEventListener('DOMContentLoaded', () => {
  const token   = localStorage.getItem('token');
  const usuario = localStorage.getItem('usuario');
  if (token && usuario) { Api.token = token; App.usuario = JSON.parse(usuario); App.iniciar(); }
  document.getElementById('login-senha').addEventListener('keydown', e => { if (e.key === 'Enter') App.login(); });
});
