const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const path    = require('path');
const { getDB }      = require('../db/database');
const { autenticar } = require('../middleware/auth');

const router  = express.Router();
router.use(autenticar);
const upload  = multer({ dest: require('os').tmpdir(), limits: { fileSize: 50 * 1024 * 1024 } });

// GET /api/backup/exportar-json
router.get('/exportar-json', (req, res) => {
  const db = getDB();
  try {
    const dados = {
      versao: '2.0',
      exportado_em:   new Date().toISOString(),
      ordens_servico: db.prepare('SELECT * FROM ordens_servico').all(),
      pecas_os:       db.prepare('SELECT * FROM pecas_os').all(),
      fornecedores:   db.prepare('SELECT * FROM fornecedores').all(),
      historico:      db.prepare('SELECT * FROM historico_status').all(),
    };
    const nome = 'backup-compras-' + new Date().toISOString().split('T')[0] + '.json';
    res.setHeader('Content-Disposition', 'attachment; filename="' + nome + '"');
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(dados, null, 2));
  } catch(e) { res.status(500).json({ erro: 'Erro ao exportar: ' + e.message }); }
});

// POST /api/backup/restaurar — restaura tudo incluindo peças
router.post('/restaurar', express.json({ limit: '50mb' }), (req, res) => {
  const db = getDB();
  const dados = req.body;
  if (!dados || typeof dados !== 'object') return res.status(400).json({ erro: 'JSON inválido' });

  let os_imp = 0, pecas_imp = 0, forn_imp = 0, erros = [];

  try {
    // 1. Fornecedores
    for (const f of (dados.fornecedores || [])) {
      if (!f.nome) continue;
      try {
        if (!db.prepare('SELECT id FROM fornecedores WHERE nome = ?').get(f.nome)) {
          db.prepare('INSERT INTO fornecedores (nome, cnpj, contato, telefone, email, cidade, estado, observacoes) VALUES (?,?,?,?,?,?,?,?)')
            .run(f.nome, f.cnpj||null, f.contato||null, f.telefone||null, f.email||null, f.cidade||null, f.estado||null, f.observacoes||null);
          forn_imp++;
        }
      } catch(e) { erros.push('Forn ' + f.nome + ': ' + e.message); }
    }

    // 2. Ordens de serviço — mapa de ID antigo → novo
    const mapaOS = {};
    for (const os of (dados.ordens_servico || [])) {
      if (!os.numero_os) continue;
      try {
        const existente = db.prepare('SELECT id FROM ordens_servico WHERE numero_os = ?').get(os.numero_os);
        if (existente) {
          mapaOS[os.id] = existente.id;
        } else {
          db.prepare(`INSERT INTO ordens_servico
            (numero_os, cliente, equipamento, data_abertura, data_conclusao_estimada, status, prioridade, tipo, transporte, observacoes)
            VALUES (?,?,?,?,?,?,?,?,?,?)`)
            .run(os.numero_os, os.cliente, os.equipamento||'—', os.data_abertura,
                os.data_conclusao_estimada||null, os.status||'Aberta', os.prioridade||'Média',
                os.tipo||'OS', os.transporte||null, os.observacoes||null);
          const nova = db.prepare('SELECT id FROM ordens_servico WHERE numero_os = ?').get(os.numero_os);
          mapaOS[os.id] = nova.id;
          os_imp++;
        }
      } catch(e) { erros.push('OS ' + os.numero_os + ': ' + e.message); }
    }

    // 3. Peças — usando mapa de IDs
    for (const p of (dados.pecas_os || [])) {
      if (!p.descricao) continue;
      const osId = mapaOS[p.os_id];
      if (!osId) continue;
      try {
        // Verifica se peça já existe (mesmo código e descrição na mesma OS)
        const existe = db.prepare('SELECT id FROM pecas_os WHERE os_id = ? AND codigo = ? AND descricao = ?')
          .get(osId, p.codigo||null, p.descricao);
        if (!existe) {
          db.prepare(`INSERT INTO pecas_os
            (os_id, codigo, descricao, quantidade, preco_unitario, preco_cotado, preco_fechado,
             fornecedor_id, status_entrega, data_entrega_prevista, numero_rastreio, observacoes)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
            .run(osId, p.codigo||null, p.descricao, p.quantidade||1,
                p.preco_unitario||null, p.preco_cotado||null, p.preco_fechado||null,
                null, p.status_entrega||'Pendente',
                p.data_entrega_prevista||null, p.numero_rastreio||null, p.observacoes||null);
          pecas_imp++;
        }
      } catch(e) { erros.push('Peça ' + p.descricao + ': ' + e.message); }
    }

    res.json({
      mensagem: os_imp + ' O.S., ' + pecas_imp + ' peças e ' + forn_imp + ' fornecedores restaurados.',
      os_imp, pecas_imp, forn_imp, erros: erros.slice(0, 10)
    });
  } catch(e) {
    res.status(500).json({ erro: 'Erro na restauração: ' + e.message });
  }
});

// POST /api/backup/importar-fornecedores-excel
router.post('/importar-fornecedores-excel', upload.single('arquivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
  try {
    const XLSX = require('xlsx');
    const db   = getDB();
    const wb   = XLSX.readFile(req.file.path, { type: 'file' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (!rows.length) return res.status(400).json({ erro: 'Planilha vazia' });

    const getCol = (row, ...keys) => {
      for (const k of keys) {
        const found = Object.keys(row).find(c => c.toLowerCase().includes(k.toLowerCase()));
        if (found && row[found] && String(row[found]).trim() && String(row[found]).trim() !== 'COM: ()') {
          return String(row[found]).trim();
        }
      }
      return null;
    };

    let importados = 0, ignorados = 0, erros = [];
    for (const row of rows) {
      const nome = getCol(row, 'Razão Social', 'razao') || getCol(row, 'Nome Fantasia', 'fantasia');
      if (!nome) { ignorados++; continue; }
      if (db.prepare('SELECT id FROM fornecedores WHERE nome = ?').get(nome)) { ignorados++; continue; }
      try {
        db.prepare('INSERT INTO fornecedores (nome, cnpj, telefone, email, cidade, estado) VALUES (?,?,?,?,?,?)')
          .run(nome, getCol(row,'CNPJ','CPF','R.U.'), getCol(row,'Telefone'), getCol(row,'E-mail','email'), getCol(row,'Cidade'), getCol(row,'UF','estado'));
        importados++;
      } catch(e) { erros.push(nome + ': ' + e.message); }
    }
    fs.unlinkSync(req.file.path);
    res.json({ mensagem: importados + ' fornecedores importados, ' + ignorados + ' ignorados', importados, ignorados, erros: erros.slice(0,10) });
  } catch(e) { res.status(500).json({ erro: 'Erro ao processar planilha: ' + e.message }); }
});

module.exports = router;
