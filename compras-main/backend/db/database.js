/**
 * database.js — SQLite local + PostgreSQL produção (async/await)
 */
const isProd = !!process.env.DATABASE_URL;
let _db = null;
let _pool = null;

function getPool() {
  if (!_pool) {
    const { Pool } = require('pg');
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10
    });
  }
  return _pool;
}

function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => '$' + (++i));
}

function addReturning(sql) {
  const up = sql.trim().toUpperCase();
  if (up.startsWith('INSERT') && !up.includes('RETURNING')) return sql.trim() + ' RETURNING id';
  return sql;
}

const pgDB = {
  _tipo: 'postgres',
  async query(sql, params = []) {
    const pool = getPool();
    const r = await pool.query(toPg(sql), params);
    return { rows: r.rows, rowCount: r.rowCount };
  },
  prepare(sql) {
    return {
      async run(...params) {
        const pool = getPool();
        const r = await pool.query(toPg(addReturning(sql)), params);
        return { changes: r.rowCount, lastInsertRowid: r.rows[0]?.id || null };
      },
      async get(...params) {
        const pool = getPool();
        const r = await pool.query(toPg(sql), params);
        return r.rows[0];
      },
      async all(...params) {
        const pool = getPool();
        const r = await pool.query(toPg(sql), params);
        return r.rows;
      }
    };
  },
  async exec(sql) {
    const pool = getPool();
    await pool.query(sql);
  }
};

async function initSQLite() {
  const path = require('path'), fs = require('fs');
  const initSqlJs = require('sql.js');
  const dataDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'compras.db');
  const SQL = await initSqlJs();
  const db = fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();
  const save = () => { try { fs.writeFileSync(dbPath, Buffer.from(db.export())); } catch(e) {} };
  [
    `CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE, senha_hash TEXT NOT NULL, papel TEXT NOT NULL DEFAULT 'operador', ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')))`,
    `CREATE TABLE IF NOT EXISTS ordens_servico (id INTEGER PRIMARY KEY AUTOINCREMENT, numero_os TEXT NOT NULL UNIQUE, cliente TEXT NOT NULL, equipamento TEXT NOT NULL, data_abertura TEXT NOT NULL, data_conclusao_estimada TEXT, status TEXT NOT NULL DEFAULT 'Aberta', prioridade TEXT NOT NULL DEFAULT 'Média', tipo TEXT NOT NULL DEFAULT 'OS', transporte TEXT, transporte_obs TEXT, observacoes TEXT, criado_por INTEGER, criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')), atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')))`,
    `CREATE TABLE IF NOT EXISTS pecas_os (id INTEGER PRIMARY KEY AUTOINCREMENT, os_id INTEGER NOT NULL, codigo TEXT, descricao TEXT NOT NULL, quantidade INTEGER NOT NULL DEFAULT 1, preco_unitario REAL, preco_cotado REAL, preco_fechado REAL, fornecedor_id INTEGER, status_entrega TEXT NOT NULL DEFAULT 'Pendente', data_entrega_prevista TEXT, numero_rastreio TEXT, observacoes TEXT, transporte TEXT, codigo_fabricante TEXT, criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')), atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')))`,
    `CREATE TABLE IF NOT EXISTS fornecedores (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, cnpj TEXT, contato TEXT, telefone TEXT, email TEXT, cidade TEXT, estado TEXT, observacoes TEXT, criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')))`,
    `CREATE TABLE IF NOT EXISTS historico_status (id INTEGER PRIMARY KEY AUTOINCREMENT, os_id INTEGER NOT NULL, status_anterior TEXT, status_novo TEXT NOT NULL, observacao TEXT, usuario_id INTEGER, criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')))`,
    `CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT NOT NULL, atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')))`,
    `CREATE TABLE IF NOT EXISTS comentarios_peca (id INTEGER PRIMARY KEY AUTOINCREMENT, peca_id INTEGER NOT NULL, usuario_id INTEGER, texto TEXT NOT NULL, criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')))`,
  ].forEach(sql => { try { db.run(sql); } catch(e) {} });
  save();
  return {
    _tipo: 'sqlite',
    prepare(sql) {
      return {
        run(...p)  { db.run(sql, p); save(); const r = db.exec('SELECT last_insert_rowid() as id'); return { changes: 1, lastInsertRowid: r[0]?.values[0]?.[0] ?? null }; },
        get(...p)  { const s = db.prepare(sql); s.bind(p); const row = s.step() ? s.getAsObject() : undefined; s.free(); return row; },
        all(...p)  { const rows = []; const s = db.prepare(sql); s.bind(p); while (s.step()) rows.push(s.getAsObject()); s.free(); return rows; }
      };
    },
    exec(sql) { db.run(sql); save(); }
  };
}

async function initDB() {
  if (_db) return _db;
  if (isProd) {
    console.log('  🌐 Modo produção — PostgreSQL (Supabase)');
    _db = pgDB;
  } else {
    console.log('  💻 Modo local — SQLite');
    _db = await initSQLite();
  }
  return _db;
}

function getDB() {
  if (!_db) throw new Error('Banco não inicializado');
  return _db;
}

module.exports = { initDB, getDB };
