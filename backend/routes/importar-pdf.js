/**
 * Importador de O.S. via PDF — BRU Compressores
 * Baseado no pdfExtractor do projeto BRU Rentabilidade.
 * Usa pdf-parse v2 da mesma forma que o projeto comercial.
 */
const express  = require('express');
const multer   = require('multer');
const fs       = require('fs');
const { getDB }      = require('../db/database');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);
const upload = multer({ dest: require('os').tmpdir(), limits: { fileSize: 20 * 1024 * 1024 } });

// Carrega pdf-parse igual ao projeto comercial
let PDFParse = null;
function carregarPDFParse() {
  if (!PDFParse) PDFParse = require('pdf-parse');
  return PDFParse;
}

function toNumero(s) {
  if (s == null) return 0;
  return parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0;
}

function extrairOSPrimam(text) {
  const linhas = text.split('\n').map(l => l.trim());
  const r = {
    numero_os: '', cliente: '', data_abertura: '', data_conclusao: '',
    prioridade: 'Media', equipamento: '', numero_serie: '', marca: '', pecas: []
  };

  // Numero da OS: codigo de rastreio PR...XXXX (ultimos 4 digitos)
  let m = text.match(/PR\d{10,}(\d{4})\b/);
  if (m) r.numero_os = String(parseInt(m[1], 10));

  // Cliente com CNPJ na mesma linha
  for (const ln of linhas) {
    const mm = ln.match(/\d+\s*-\s*(.+?)(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
    if (mm) { r.cliente = mm[1].trim(); break; }
  }
  // Fallback cliente sem CNPJ
  if (!r.cliente) {
    for (const ln of linhas) {
      const mm = ln.match(/^\d{3,6}\s*-\s*([A-Z].{4,60})$/);
      if (mm && !mm[1].includes('@') && !mm[1].includes('www')) { r.cliente = mm[1].trim(); break; }
    }
  }

  // Datas e prioridade
  for (const ln of linhas) {
    if (/NORMAL|URGENTE|ALTA/i.test(ln)) {
      const datas = Array.from(ln.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g));
      if (datas.length >= 2) r.data_conclusao = datas[1][3]+'-'+datas[1][2]+'-'+datas[1][1];
      if (/URGENTE|ALTA/i.test(ln)) r.prioridade = 'Alta';
    }
  }
  for (let i = 0; i < linhas.length; i++) {
    if (/OS AUTORIZADA|ENCOMENDADO/.test(linhas[i])) {
      for (let j = i-1; j >= Math.max(0,i-4); j--) {
        const mm = linhas[j].match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (mm) { r.data_abertura = mm[3]+'-'+mm[2]+'-'+mm[1]; break; }
      }
    }
  }
  if (!r.data_abertura) {
    const mm = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (mm) r.data_abertura = mm[3]+'-'+mm[2]+'-'+mm[1];
  }
  if (!r.data_abertura) r.data_abertura = new Date().toISOString().split('T')[0];

  // Equipamento, serie, marca das observacoes
  for (const ln of linhas) {
    const me = ln.match(/Modelo[:\s]+([^\s\/,;]+)/i); if (me) r.equipamento = me[1].trim();
    const ms = ln.match(/Nr\.\s*S[e\u00e9]rie[:\s]+([^\s\/,;]+)/i); if (ms) r.numero_serie = ms[1].trim();
    const mb = ln.match(/Marca[:\s]+([A-Z][^\n\/,]+)/i); if (mb) r.marca = mb[1].trim();
  }

  // Pecas — abordagem stateful linha a linha (igual pdfExtractor comercial)
  const numRe   = '\\d+(?:\\.\\d{3})*,\\d{2}';
  const RE_VAL  = new RegExp('^(UN|LT|KG|PC|CX|MT|GL|M2|M3|PAR|JG|SC)(' + numRe + ')(' + numRe + ')(' + numRe + ')\\d*$', 'i');
  const RE_TUDO = new RegExp('^(\\d{3,6})(.+?)(UN|LT|KG|PC|CX|MT|GL)(' + numRe + ')(' + numRe + ')(' + numRe + ')\\d*$', 'i');
  const ANOS    = new Set(['2023','2024','2025','2026','2027','2028']);

  let emProdutos = false, codigoPendente = null, descricaoPendente = null;

  for (const ln of linhas) {
    if (/^PRODUTO\(S\)$/.test(ln))                           { emProdutos = true;  continue; }
    if (/^SERVI[C\u00c7]O\(S\)$/.test(ln) || /^Subtotal Produto/.test(ln)) { emProdutos = false; continue; }
    if (!emProdutos || !ln) continue;

    // Tudo numa linha: "8501OLEO...LT10,00190,001.900,004"
    const mTudo = ln.match(RE_TUDO);
    if (mTudo) {
      r.pecas.push({ codigo: mTudo[1], descricao: mTudo[2].trim(), quantidade: toNumero(mTudo[4]), preco_unitario: toNumero(mTudo[5]) });
      codigoPendente = null; descricaoPendente = null;
      continue;
    }

    // Linha de valores UN/LT... + numeros
    const mVal = ln.match(RE_VAL);
    if (mVal && codigoPendente) {
      r.pecas.push({ codigo: codigoPendente, descricao: descricaoPendente || '', quantidade: toNumero(mVal[2]), preco_unitario: toNumero(mVal[3]) });
      codigoPendente = null; descricaoPendente = null;
      continue;
    }

    // Codigo isolado
    if (/^\d{3,6}$/.test(ln) && !ANOS.has(ln)) {
      codigoPendente = ln; descricaoPendente = null;
      continue;
    }

    // Descricao (linha logo apos codigo)
    if (codigoPendente && !descricaoPendente && ln && !/^(C.digo|Item|Unid|Valor)/i.test(ln)) {
      descricaoPendente = ln;
      continue;
    }
  }

  return r;
}

// POST /api/importar-pdf
router.post('/', upload.array('arquivos', 50), async (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });

  const pdfParse = carregarPDFParse();
  const db = getDB();
  const resultados = [];

  for (const file of req.files) {
    const nome = file.originalname;
    try {
      const buffer = fs.readFileSync(file.path);
      // Usa a mesma chamada do projeto comercial
      const parsed = await pdfParse(buffer);
      const dados  = extrairOSPrimam(parsed.text);

      if (!dados.numero_os) throw new Error('Numero de O.S. nao encontrado no PDF');
      if (!dados.cliente)   throw new Error('Cliente nao identificado no PDF');

      const equipamento = [
        dados.equipamento,
        dados.numero_serie ? 'Serie: ' + dados.numero_serie : null,
        dados.marca
      ].filter(Boolean).join(' \u2014 ') || 'Equipamento nao identificado';

      let osId;
      const osExistente = await Promise.resolve(db.prepare('SELECT id FROM ordens_servico WHERE numero_os = ?').get(dados.numero_os));

      if (osExistente) {
        osId = osExistente.id;
      } else {
        db.prepare(
          "INSERT INTO ordens_servico (numero_os, cliente, equipamento, data_abertura, data_conclusao_estimada, status, prioridade, criado_por) VALUES (?, ?, ?, ?, ?, 'Aberta', ?, ?)"
        ).run(dados.numero_os, dados.cliente, equipamento, dados.data_abertura, dados.data_conclusao || null, dados.prioridade, req.usuario.id);
        // Busca o ID real pelo numero_os (evita problema de lastInsertRowid no sql.js)
        osId = await Promise.resolve(db.prepare('SELECT id FROM ordens_servico WHERE numero_os = ?').get(dados.numero_os)).id;
        db.prepare('INSERT INTO historico_status (os_id, status_anterior, status_novo, observacao, usuario_id) VALUES (?, ?, ?, ?, ?)')
          .run(osId, null, 'Aberta', 'Importado via PDF: ' + nome, req.usuario.id);
      }

      // Importa pecas apenas se OS ainda nao tem nenhuma
      const jaTem = db.prepare('SELECT COUNT(*) as total FROM pecas_os WHERE os_id = ?').get(osId).total;
      let pecasImportadas = 0;
      if (jaTem === 0) {
        for (const p of dados.pecas) {
          if (!p.descricao) continue;
          db.prepare("INSERT INTO pecas_os (os_id, codigo, descricao, quantidade, preco_unitario, status_entrega) VALUES (?, ?, ?, ?, ?, 'Pendente')")
            .run(osId, p.codigo || null, p.descricao, p.quantidade || 1, p.preco_unitario || null);
          pecasImportadas++;
        }
      }

      resultados.push({ arquivo: nome, sucesso: true, numero_os: dados.numero_os, cliente: dados.cliente, os_ja_existia: !!osExistente, pecas_importadas: pecasImportadas });

    } catch (e) {
      resultados.push({ arquivo: nome, sucesso: false, erro: e.message });
    } finally {
      try { fs.unlinkSync(file.path); } catch (_) {}
    }
  }

  const ok = resultados.filter(r => r.sucesso);
  const totalPecas = ok.reduce((s, r2) => s + r2.pecas_importadas, 0);
  res.json({ mensagem: ok.length + ' O.S. importada(s), ' + totalPecas + ' pecas adicionadas.', resultados });
});

module.exports = router;
