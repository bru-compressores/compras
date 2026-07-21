const express  = require('express');
const multer   = require('multer');
const fs       = require('fs');
const { getDB }      = require('../db/database');
const { autenticar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar);
const upload = multer({ dest: require('os').tmpdir(), limits: { fileSize: 20 * 1024 * 1024 } });

let PDFParse = null;
function getPDFParse() {
  if (!PDFParse) PDFParse = require('pdf-parse');
  return PDFParse;
}

function toNum(s) {
  return parseFloat(String(s||'0').replace(/\./g,'').replace(',','.')) || 0;
}

function extrairOSPrimam(text) {
  const UNIDS      = 'UN|LT|L|KG|PC|CX|MT|GL|M2|M3|PAR|JG|SC';
  const N          = '\\d+(?:\\.\\d{3})*,\\d{2}';
  const ANOS       = new Set(['2023','2024','2025','2026','2027','2028']);
  const RE_TUDO    = new RegExp(`^(\\d{3,6})(.+?)(${UNIDS})(${N})(${N})(${N})\\d*$`, 'i');
  const RE_VAL     = new RegExp(`^(${UNIDS})(${N})(${N})(${N})\\d*$`, 'i');
  // Layout 1: código grudado com descrição na mesma linha: "7544CORREIA"
  const RE_COD_DESC = /^(\d{3,6})([A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇÃ].+)$/;
  const RE_L2_PC   = /^(\d+(?:\.\d{3})*,\d{4})(\d{3,6})$/;
  const RE_L2_U    = new RegExp(`^(${UNIDS})(\\d+,\\d{2})(.*)$`, 'i');

  const linhas = text.split('\n').map(l => l.trim());
  const r = {
    numero_os: '', cliente: '', data_abertura: '',
    data_conclusao: '', prioridade: 'Media',
    equipamento: '', numero_serie: '', marca: '', pecas: []
  };

  // Número da OS via código de rastreio PR...XXXX
  const mOS = text.match(/PR\d{10,}(\d{4})\b/);
  if (mOS) r.numero_os = String(parseInt(mOS[1], 10));

  // Cliente
  for (const ln of linhas) {
    const m = ln.match(/\d+\s*-\s*(.+?)(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
    if (m) { r.cliente = m[1].trim(); break; }
  }
  if (!r.cliente) {
    for (const ln of linhas) {
      const m = ln.match(/^\d{3,6}\s*-\s*([A-Z].{4,60})$/);
      if (m && !m[1].includes('@')) { r.cliente = m[1].trim(); break; }
    }
  }

  // Datas
  for (const ln of linhas) {
    if (/NORMAL|URGENTE|ALTA/i.test(ln)) {
      const datas = [...ln.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)];
      if (datas.length >= 2) r.data_conclusao = datas[1][3]+'-'+datas[1][2]+'-'+datas[1][1];
      if (/URGENTE|ALTA/i.test(ln)) r.prioridade = 'Alta';
    }
  }
  for (let i = 0; i < linhas.length; i++) {
    if (/OS AUTORIZADA|ENCOMENDADO|LIBERADO PARA/.test(linhas[i])) {
      for (let j = i-1; j >= Math.max(0,i-6); j--) {
        const m = linhas[j].match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (m) { r.data_abertura = m[3]+'-'+m[2]+'-'+m[1]; break; }
      }
    }
  }
  if (!r.data_abertura) {
    const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) r.data_abertura = m[3]+'-'+m[2]+'-'+m[1];
  }
  if (!r.data_abertura) r.data_abertura = new Date().toISOString().split('T')[0];

  // Equipamento/série/marca
  for (const ln of linhas) {
    const me = ln.match(/Modelo[:\s]+([^\s\/,;]+)/i); if (me) r.equipamento = me[1].trim();
    const ms = ln.match(/Nr\.\s*S[eé]rie[:\s]+([^\s\/,;]+)/i); if (ms) r.numero_serie = ms[1].trim();
    const mb = ln.match(/Marca[:\s]+([A-Z][^\n\/,]+)/i); if (mb) r.marca = mb[1].trim();
  }

  // ── Extração de peças ─────────────────────────────────────────────────────
  let emProd = false;
  let cod1 = null, desc1 = null;          // estado Layout 1
  let l2_preco = null, l2_cod = null, l2_desc = null; // estado Layout 2

  for (const ln of linhas) {
    if (/^PRODUTO\(S\)$/.test(ln))                                    { emProd = true;  continue; }
    if (/^SERVI[ÇC]O\(S\)$/.test(ln)||/^Subtotal Produto/.test(ln))  { emProd = false; continue; }
    if (!emProd || !ln) continue;
    if (/^(C[oó]digo|Item|Unid|Quantidade|Descri)/i.test(ln))        continue;

    // Layout 1 — tudo numa linha
    const mTudo = ln.match(RE_TUDO);
    if (mTudo) {
      r.pecas.push({ codigo: mTudo[1], descricao: mTudo[2].trim(), quantidade: toNum(mTudo[4]), preco_unitario: toNum(mTudo[5]), codigo_fabricante: null });
      cod1 = null; desc1 = null; l2_preco = null; l2_cod = null; l2_desc = null;
      continue;
    }

    // Layout 2 — linha "preco4dec + codigo" ex: "282,00006110"
    const mL2PC = ln.match(RE_L2_PC);
    if (mL2PC) {
      l2_preco = toNum(mL2PC[1].replace(/,(\d{2})\d{2}$/, ',$1')); // converte 4dec → 2dec
      l2_cod   = mL2PC[2];
      l2_desc  = null;
      cod1 = null; desc1 = null;
      continue;
    }

    // Layout 2 — descrição (linha após preco+cod)
    if (l2_cod && !l2_desc && ln && !/^\d/.test(ln)) {
      l2_desc = ln;
      continue;
    }

    // Layout 2 — "UNID + QTD2dec + COD_FABRICANTE"
    if (l2_cod && l2_desc) {
      const mL2U = ln.match(RE_L2_U);
      if (mL2U) {
        r.pecas.push({ codigo: l2_cod, descricao: l2_desc.trim(), quantidade: toNum(mL2U[2]), preco_unitario: l2_preco, codigo_fabricante: mL2U[3].trim() || null });
        l2_preco = null; l2_cod = null; l2_desc = null;
        continue;
      }
    }

    // Layout 1 — linha de valores
    const mVal = ln.match(RE_VAL);
    if (mVal && cod1) {
      r.pecas.push({ codigo: cod1, descricao: desc1 || '', quantidade: toNum(mVal[2]), preco_unitario: toNum(mVal[3]), codigo_fabricante: null });
      cod1 = null; desc1 = null;
      continue;
    }

    // Layout 1 — código isolado
    if (/^\d{3,6}$/.test(ln) && !ANOS.has(ln)) {
      cod1 = ln; desc1 = null;
      continue;
    }

    // Layout 1 — código GRUDADO com descrição na mesma linha: "7544CORREIA"
    const mCodDesc = ln.match(RE_COD_DESC);
    if (mCodDesc && !ANOS.has(mCodDesc[1])) {
      cod1 = mCodDesc[1]; desc1 = mCodDesc[2].trim();
      continue;
    }

    // Layout 1 — descrição após código (linha separada)
    if (cod1 && !desc1 && !/^(C.digo|Item|Unid|Valor)/i.test(ln)) {
      desc1 = ln;
      continue;
    }
  }

  return r;
}

// POST /api/importar-pdf
router.post('/', upload.array('arquivos', 50), async (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });

  const pdfParse = getPDFParse();
  const db = getDB();
  const resultados = [];

  for (const file of req.files) {
    const nome = file.originalname;
    try {
      const buffer = fs.readFileSync(file.path);
      const parsed = await pdfParse(buffer);
      const dados  = extrairOSPrimam(parsed.text);

      if (!dados.numero_os) throw new Error('Número da O.S. não encontrado no PDF');
      if (!dados.pecas.length) throw new Error('Nenhuma peça encontrada no PDF');

      const equipamento = [dados.equipamento, dados.numero_serie, dados.marca].filter(Boolean).join(' — ') || 'Equipamento não identificado';

      let osId;
      const osExistente = await Promise.resolve(db.prepare('SELECT id FROM ordens_servico WHERE numero_os = ?').get(dados.numero_os));

      if (osExistente) {
        osId = osExistente.id;
      } else {
        await Promise.resolve(db.prepare(
          "INSERT INTO ordens_servico (numero_os,cliente,equipamento,data_abertura,data_conclusao_estimada,status,prioridade,criado_por) VALUES (?,?,?,?,?,'Aberta',?,?)"
        ).run(dados.numero_os, dados.cliente, equipamento, dados.data_abertura, dados.data_conclusao||null, dados.prioridade, req.usuario.id));
        const novaOS = await Promise.resolve(db.prepare('SELECT id FROM ordens_servico WHERE numero_os = ?').get(dados.numero_os));
        osId = novaOS.id;
        await Promise.resolve(db.prepare('INSERT INTO historico_status (os_id,status_anterior,status_novo,observacao,usuario_id) VALUES (?,?,?,?,?)')
          .run(osId, null, 'Aberta', 'Importado via PDF: ' + nome, req.usuario.id));
      }

      const jaTemRow = await Promise.resolve(db.prepare('SELECT COUNT(*) as total FROM pecas_os WHERE os_id = ?').get(osId));
      const jaTem = parseInt(jaTemRow?.total) || 0;
      let pecasImportadas = 0;

      if (jaTem === 0) {
        for (const p of dados.pecas) {
          if (!p.descricao) continue;
          await Promise.resolve(db.prepare(
            "INSERT INTO pecas_os (os_id,codigo,descricao,quantidade,preco_unitario,status_entrega,codigo_fabricante) VALUES (?,?,?,?,?,'Aguardando Triagem',?)"
          ).run(osId, p.codigo||null, p.descricao, p.quantidade||1, p.preco_unitario||null, p.codigo_fabricante||null));
          pecasImportadas++;
        }
      }

      resultados.push({ arquivo: nome, sucesso: true, numero_os: dados.numero_os, cliente: dados.cliente, os_ja_existia: !!osExistente, pecas_importadas: pecasImportadas });

    } catch(e) {
      resultados.push({ arquivo: nome, sucesso: false, erro: e.message });
    } finally {
      try { fs.unlinkSync(file.path); } catch(_) {}
    }
  }

  res.json({ resultados });
});

module.exports = router;
