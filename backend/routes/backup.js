const express = require('express');
const multer  = require('multer');
const fs      = require('fs');
const { getDB } = require('../db/database');
const { autenticar } = require('../middleware/auth');
const router  = express.Router();
router.use(autenticar);
const upload  = multer({ dest: require('os').tmpdir(), limits: { fileSize: 50*1024*1024 } });

const qa = (db, sql, ...p) => Promise.resolve(db.prepare(sql).all(...p));
const q  = (db, sql, ...p) => Promise.resolve(db.prepare(sql).get(...p));
const qr = (db, sql, ...p) => Promise.resolve(db.prepare(sql).run(...p));

router.get('/exportar-json', async (req, res) => {
  try {
    const db = getDB();
    const dados = {
      versao: '2.0', exportado_em: new Date().toISOString(),
      ordens_servico: await qa(db, 'SELECT * FROM ordens_servico'),
      pecas_os:       await qa(db, 'SELECT * FROM pecas_os'),
      fornecedores:   await qa(db, 'SELECT * FROM fornecedores'),
      historico:      await qa(db, 'SELECT * FROM historico_status'),
    };
    res.setHeader('Content-Disposition', `attachment; filename="backup-${new Date().toISOString().split('T')[0]}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(dados, null, 2));
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.post('/restaurar', express.json({ limit: '50mb' }), async (req, res) => {
  // Responde imediatamente para evitar timeout do proxy, processa em background
  res.json({ mensagem: 'Restauração iniciada. Isso pode levar alguns minutos — recarregue a página depois.', processando: true });

  const db = getDB();
  const dados = req.body;
  if (!dados || typeof dados !== 'object') return;

  (async () => {
    let os_imp = 0, pecas_imp = 0, forn_imp = 0, erros = [];
    try {
      // Fornecedores em paralelo (lotes de 20)
      const fornecedores = (dados.fornecedores||[]).filter(f => f.nome);
      for (let i = 0; i < fornecedores.length; i += 20) {
        const lote = fornecedores.slice(i, i+20);
        await Promise.all(lote.map(async f => {
          try {
            if (!await q(db,'SELECT id FROM fornecedores WHERE nome = ?',f.nome)) {
              await qr(db,'INSERT INTO fornecedores (nome,cnpj,contato,telefone,email,cidade,estado) VALUES (?,?,?,?,?,?,?)',f.nome,f.cnpj||null,f.contato||null,f.telefone||null,f.email||null,f.cidade||null,f.estado||null);
              forn_imp++;
            }
          } catch(e) { erros.push('Forn: ' + e.message); }
        }));
      }

      // O.S. sequencial (precisa do mapa de IDs, mas é rápido o suficiente)
      const mapaOS = {};
      const oss = (dados.ordens_servico||[]).filter(os => os.numero_os);
      for (let i = 0; i < oss.length; i += 10) {
        const lote = oss.slice(i, i+10);
        await Promise.all(lote.map(async os => {
          try {
            const ex = await q(db,'SELECT id FROM ordens_servico WHERE numero_os = ?',os.numero_os);
            if (ex) { mapaOS[os.id] = ex.id; return; }
            await qr(db,`INSERT INTO ordens_servico (numero_os,cliente,equipamento,data_abertura,data_conclusao_estimada,status,prioridade,tipo,transporte,observacoes) VALUES (?,?,?,?,?,?,?,?,?,?)`,os.numero_os,os.cliente,os.equipamento||'—',os.data_abertura,os.data_conclusao_estimada||null,os.status||'Aberta',os.prioridade||'Média',os.tipo||'OS',os.transporte||null,os.observacoes||null);
            const nova = await q(db,'SELECT id FROM ordens_servico WHERE numero_os = ?',os.numero_os);
            mapaOS[os.id] = nova.id; os_imp++;
          } catch(e) { erros.push('OS ' + os.numero_os + ': ' + e.message); }
        }));
      }

      // Peças em paralelo (lotes de 20)
      const pecas = (dados.pecas_os||[]).filter(p => p.descricao && mapaOS[p.os_id]);
      for (let i = 0; i < pecas.length; i += 20) {
        const lote = pecas.slice(i, i+20);
        await Promise.all(lote.map(async p => {
          const osId = mapaOS[p.os_id];
          try {
            if (!await q(db,'SELECT id FROM pecas_os WHERE os_id = ? AND descricao = ? LIMIT 1',osId,p.descricao)) {
              await qr(db,`INSERT INTO pecas_os (os_id,codigo,descricao,quantidade,preco_unitario,preco_cotado,preco_fechado,status_entrega,data_entrega_prevista,numero_rastreio,observacoes,transporte) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,osId,p.codigo||null,p.descricao,p.quantidade||1,p.preco_unitario||null,p.preco_cotado||null,p.preco_fechado||null,p.status_entrega||'Pendente',p.data_entrega_prevista||null,p.numero_rastreio||null,p.observacoes||null,p.transporte||null);
              pecas_imp++;
            }
          } catch(e) { erros.push('Peça: ' + e.message); }
        }));
      }

      console.log(`✅ Restauração concluída: ${os_imp} OS, ${pecas_imp} peças, ${forn_imp} fornecedores`);
      if (erros.length) console.log('Erros:', erros.slice(0,20));
    } catch(e) {
      console.error('Erro na restauração em background:', e.message);
    }
  })();
});

// GET /api/backup/status — verifica contagens atuais (para o frontend conferir progresso)
router.get('/status', async (req, res) => {
  try {
    const db = getDB();
    const os = await q(db, 'SELECT COUNT(*) as total FROM ordens_servico');
    const pecas = await q(db, 'SELECT COUNT(*) as total FROM pecas_os');
    const forn = await q(db, 'SELECT COUNT(*) as total FROM fornecedores');
    res.json({ ordens_servico: os.total, pecas_os: pecas.total, fornecedores: forn.total });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.post('/importar-fornecedores-excel', upload.single('arquivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
  try {
    const XLSX = require('xlsx');
    const db = getDB();
    const wb = XLSX.readFile(req.file.path, { type: 'file' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    if (!rows.length) return res.status(400).json({ erro: 'Planilha vazia' });
    const getCol = (row, ...keys) => { for (const k of keys) { const f = Object.keys(row).find(c => c.toLowerCase().includes(k.toLowerCase())); if (f && row[f] && String(row[f]).trim() && String(row[f]).trim() !== 'COM: ()') return String(row[f]).trim(); } return null; };
    let importados = 0, ignorados = 0;
    for (const row of rows) {
      const nome = getCol(row,'Razão Social','razao') || getCol(row,'Nome Fantasia','fantasia');
      if (!nome) { ignorados++; continue; }
      if (await q(db,'SELECT id FROM fornecedores WHERE nome = ?',nome)) { ignorados++; continue; }
      try { await qr(db,'INSERT INTO fornecedores (nome,cnpj,telefone,email,cidade,estado) VALUES (?,?,?,?,?,?)',nome,getCol(row,'CNPJ','CPF'),getCol(row,'Telefone'),getCol(row,'E-mail','email'),getCol(row,'Cidade'),getCol(row,'UF','estado')); importados++; } catch(e) {}
    }
    fs.unlinkSync(req.file.path);
    res.json({ mensagem: `${importados} fornecedores importados, ${ignorados} ignorados`, importados, ignorados });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
