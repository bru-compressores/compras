/**
 * database.js — Abstração do banco de dados
 * - Desenvolvimento (LOCAL): sql.js (SQLite em memória, salvo em arquivo)
 * - Produção (RENDER):       PostgreSQL via Supabase (DATABASE_URL)
 */

const isProduction = !!process.env.DATABASE_URL;

// ── POSTGRESQL (produção) ──────────────────────────────────────────────────
let pgPool = null;

function getPGPool() {
  if (!pgPool) {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pgPool;
}

// Wrapper que imita a interface do sql.js para PostgreSQL
function createPGWrapper() {
  const pool = getPGPool();

  return {
    _pg: true,
    prepare(sql) {
      // Converte ? para $1, $2... (padrão do PostgreSQL)
      const pgSql = sql.replace(/\?/g, (_, i) => {
        // conta quantos ? já foram antes
        let count = 0;
        for (let j = 0; j < _.index; j++) if (sql[j] === '?') count++;
        return '$' + (count + 1);
      });

      // Faz a conversão correta contando os ?
      let idx = 0;
      const convertedSql = sql.replace(/\?/g, () => '$' + (++idx));

      return {
        run(...params) {
          // Síncrono via deasync — mas para produção usamos async
          // Esta função é chamada de forma síncrona, então usamos pg-sync
          throw new Error('Use runAsync no PostgreSQL');
        },
        get(...params) { throw new Error('Use getAsync no PostgreSQL'); },
        all(...params) { throw new Error('Use allAsync no PostgreSQL'); },
        // Versões async para uso interno
        async runAsync(params = []) {
          const r = await pool.query(convertedSql, params);
          return { changes: r.rowCount, lastInsertRowid: r.rows[0]?.id || null };
        },
        async getAsync(params = []) {
          const r = await pool.query(convertedSql, params);
          return r.rows[0];
        },
        async allAsync(params = []) {
          const r = await pool.query(convertedSql, params);
          return r.rows;
        }
      };
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async query(sql, params = []) {
      return pool.query(sql, params);
    }
  };
}

// ── SQLITE LOCAL (desenvolvimento) ────────────────────────────────────────
let sqliteDB = null;

async function initSQLite() {
  if (sqliteDB) return sqliteDB;

  const path   = require('path');
  const fs     = require('fs');
  const initSqlJs = require('sql.js');

  const dataDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'compras.db');

  const SQL = await initSqlJs();
  let db;
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }

  // Função de salvamento
  const save = () => {
    try { fs.writeFileSync(dbPath, Buffer.from(db.export())); } catch(e) {}
  };

  // Cria tabelas
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    papel TEXT NOT NULL DEFAULT 'operador',
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS ordens_servico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_os TEXT NOT NULL UNIQUE,
    cliente TEXT NOT NULL,
    equipamento TEXT NOT NULL,
    data_abertura TEXT NOT NULL,
    data_conclusao_estimada TEXT,
    status TEXT NOT NULL DEFAULT 'Aberta',
    prioridade TEXT NOT NULL DEFAULT 'Média',
    tipo TEXT NOT NULL DEFAULT 'OS',
    transporte TEXT,
    transporte_obs TEXT,
    observacoes TEXT,
    criado_por INTEGER,
    criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS pecas_os (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    os_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
    codigo TEXT,
    descricao TEXT NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 1,
    preco_unitario REAL,
    preco_cotado REAL,
    preco_fechado REAL,
    fornecedor_id INTEGER,
    status_entrega TEXT NOT NULL DEFAULT 'Pendente',
    data_entrega_prevista TEXT,
    numero_rastreio TEXT,
    observacoes TEXT,
    transporte TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS fornecedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cnpj TEXT,
    contato TEXT,
    telefone TEXT,
    email TEXT,
    cidade TEXT,
    estado TEXT,
    observacoes TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS historico_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    os_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
    status_anterior TEXT,
    status_novo TEXT NOT NULL,
    observacao TEXT,
    usuario_id INTEGER,
    criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS configuracoes (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS comentarios_peca (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    peca_id INTEGER NOT NULL REFERENCES pecas_os(id) ON DELETE CASCADE,
    usuario_id INTEGER,
    texto TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`);
  save();

  // Wrapper síncrono compatível com o resto do código
  const wrapper = {
    _sql: { _db: db },
    prepare(sql) {
      return {
        run(...p) {
          db.run(sql, p);
          save();
          const r = db.exec('SELECT last_insert_rowid() as id');
          return { changes: 1, lastInsertRowid: r[0]?.values[0]?.[0] ?? null };
        },
        get(...p) {
          const s = db.prepare(sql); s.bind(p);
          const row = s.step() ? s.getAsObject() : undefined;
          s.free(); return row;
        },
        all(...p) {
          const rows = []; const s = db.prepare(sql); s.bind(p);
          while (s.step()) rows.push(s.getAsObject());
          s.free(); return rows;
        }
      };
    },
    exec(sql) { db.run(sql); save(); },
    query(sql, params) {
      // Compatibilidade básica com interface PG
      const rows = [];
      const s = db.prepare(sql);
      if (params) s.bind(params);
      while (s.step()) rows.push(s.getAsObject());
      s.free();
      return { rows };
    }
  };

  sqliteDB = wrapper;
  return wrapper;
}

// ── API PÚBLICA ────────────────────────────────────────────────────────────
let _db = null;

async function initDB() {
  if (_db) return _db;
  if (isProduction) {
    console.log('  🌐 Modo produção — PostgreSQL (Supabase)');
    _db = createPGWrapper();
  } else {
    console.log('  💻 Modo local — SQLite');
    _db = await initSQLite();
  }
  return _db;
}

function getDB() {
  if (!_db) throw new Error('Banco não inicializado. Chame initDB() primeiro.');
  return _db;
}

module.exports = { initDB, getDB };
