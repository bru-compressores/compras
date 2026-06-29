const { initDB } = require('./database');

initDB().then(db => {
  const colunas = [
    `ALTER TABLE ordens_servico ADD COLUMN tipo TEXT NOT NULL DEFAULT 'OS'`,
    `ALTER TABLE ordens_servico ADD COLUMN transporte_obs TEXT`,
    `ALTER TABLE pecas_os ADD COLUMN preco_cotado REAL`,
    `ALTER TABLE pecas_os ADD COLUMN preco_fechado REAL`,
    `ALTER TABLE fornecedores ADD COLUMN cnpj TEXT`,
    `ALTER TABLE fornecedores ADD COLUMN cidade TEXT`,
    `ALTER TABLE fornecedores ADD COLUMN estado TEXT`,
  ];

  for (const sql of colunas) {
    try {
      db.exec(sql);
      console.log('  + ' + sql.split(' ').slice(4,6).join(' '));
    } catch(e) {
      console.log('  = ja existe: ' + sql.split(' ').slice(4,6).join(' '));
    }
  }

  console.log('\n  Banco atualizado!\n');
  process.exit(0);
}).catch(e => { console.error('  Erro:', e.message); process.exit(1); });
