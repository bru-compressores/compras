const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { initDB } = require('./db/database');

const app  = express();
const PORT = process.env.PORT || 3000;
const isProd = !!process.env.DATABASE_URL;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

async function runMigrations(db) {
  if (isProd) {
    // PostgreSQL — tabelas já criadas via migrate-pg.sql no Supabase
    console.log('  ✅ PostgreSQL — migrações via Supabase');
    return;
  }
  // SQLite local — migrações inline
  const migrations = [
    `ALTER TABLE ordens_servico ADD COLUMN tipo TEXT NOT NULL DEFAULT 'OS'`,
    `ALTER TABLE ordens_servico ADD COLUMN transporte_obs TEXT`,
    `ALTER TABLE pecas_os ADD COLUMN preco_cotado REAL`,
    `ALTER TABLE pecas_os ADD COLUMN preco_fechado REAL`,
    `ALTER TABLE pecas_os ADD COLUMN transporte TEXT`,
    `ALTER TABLE fornecedores ADD COLUMN cnpj TEXT`,
    `ALTER TABLE fornecedores ADD COLUMN cidade TEXT`,
    `ALTER TABLE fornecedores ADD COLUMN estado TEXT`,
    `CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT NOT NULL, atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')))`,
    `CREATE TABLE IF NOT EXISTS comentarios_peca (id INTEGER PRIMARY KEY AUTOINCREMENT, peca_id INTEGER NOT NULL, usuario_id INTEGER, texto TEXT NOT NULL, criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')))`,
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch(e) { /* já existe */ }
  }
  console.log('  ✅ SQLite — migrações aplicadas');
}

initDB().then(async db => {
  await runMigrations(db);

  // Criar admin padrão se não existir (só SQLite — no PG já está no migrate-pg.sql)
  if (!isProd) {
    try {
      const existe = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('admin@empresa.com');
      if (!existe) {
        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('admin123', 10);
        db.prepare("INSERT INTO usuarios (nome,email,senha_hash,papel) VALUES (?,?,?,?)").run('Administrador','admin@empresa.com',hash,'admin');
        console.log('  ✅ Usuário admin criado: admin@empresa.com / admin123');
      }
    } catch(e) {}
  }

  app.use('/api/auth',          require('./routes/usuarios'));
  app.use('/api/usuarios',      require('./routes/usuarios'));
  app.use('/api/os',            require('./routes/ordens'));
  app.use('/api/pecas',         require('./routes/pecas'));
  app.use('/api/fornecedores',  require('./routes/fornecedores'));
  app.use('/api/importar-pdf',  require('./routes/importar-pdf'));
  app.use('/api/backup',        require('./routes/backup'));
  app.use('/api/configuracoes', require('./routes/configuracoes'));
  app.use('/api/relatorios',    require('./routes/relatorios'));
  app.use('/api/pdf-os',        require('./routes/pdf-os'));
  app.use('/api/comentarios',   require('./routes/comentarios'));
  app.use('/api/triagem',       require('./routes/triagem'));
  app.use('/api/saving',         require('./routes/saving'));
  app.use('/api',               require('./routes/dashboard'));

  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html')));

  app.listen(PORT, () => {
    console.log(`\n  ✅ Servidor rodando em http://localhost:${PORT}`);
    if (!isProd) {
      console.log(`  📋 Login: admin@empresa.com / admin123`);
      console.log(`  💾 Banco: data/compras.db\n`);
    }
  });
}).catch(err => {
  console.error('\n  ❌ Erro ao iniciar:', err.message);
  process.exit(1);
});
