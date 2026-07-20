const express = require('express');
const { getDB } = require('../db/database');
const { autenticar, apenasAdmin } = require('../middleware/auth');
const router = express.Router();
router.use(autenticar);

// Garante tabela de configurações
function ensureTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS configuracoes (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`);
}

// Defaults do sistema
const DEFAULTS = {
  markup_verde:   '2.2',
  markup_laranja: '2.0',
  dashboard_ordem: JSON.stringify(['total_os','aguardando','atrasadas','transito','pendentes','concluidas']),
  dashboard_ocultos: JSON.stringify([]),
};

router.get('/', (req, res) => {
  const db = getDB();
  ensureTable(db);
  const rows = db.prepare('SELECT chave, valor FROM configuracoes').all();
  const cfg = { ...DEFAULTS };
  rows.forEach(r => cfg[r.chave] = r.valor);
  res.json(cfg);
});

router.put('/', apenasAdmin, (req, res) => {
  const db = getDB();
  ensureTable(db);
  const permitidas = Object.keys(DEFAULTS);
  for (const [chave, valor] of Object.entries(req.body)) {
    if (!permitidas.includes(chave)) continue;
    const v = typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
    db.prepare(`INSERT INTO configuracoes (chave, valor) VALUES (?,?)
      ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor, atualizado_em=datetime('now','localtime')`)
      .run(chave, v);
  }
  res.json({ mensagem: 'Configurações salvas' });
});

module.exports = router;
