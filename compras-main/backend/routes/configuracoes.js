const express = require('express');
const { getDB } = require('../db/database');
const { autenticar, apenasAdmin } = require('../middleware/auth');
const router = express.Router();
router.use(autenticar);

const DEFAULTS = { markup_verde:'2.2', markup_laranja:'2.0', dashboard_ordem:'[]', dashboard_ocultos:'[]' };

router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const rows = await Promise.resolve(db.prepare('SELECT chave, valor FROM configuracoes').all());
    const cfg = { ...DEFAULTS };
    rows.forEach(r => cfg[r.chave] = r.valor);
    res.json(cfg);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.put('/', apenasAdmin, async (req, res) => {
  try {
    const db = getDB();
    for (const [chave, valor] of Object.entries(req.body)) {
      if (!Object.keys(DEFAULTS).includes(chave)) continue;
      const v = typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
      await Promise.resolve(db.prepare(`INSERT INTO configuracoes (chave,valor) VALUES (?,?) ON CONFLICT(chave) DO UPDATE SET valor=EXCLUDED.valor`).run(chave, v));
    }
    res.json({ mensagem: 'Configurações salvas' });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
