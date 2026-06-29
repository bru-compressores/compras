/**
 * database.js — SQLite local + PostgreSQL produção
 * Abordagem: worker thread síncrono para PostgreSQL
 */

const isProd = !!process.env.DATABASE_URL;
let _db = null;

// ── SQLITE LOCAL ──────────────────────────────────────────────────────────
async function initSQLite() {
  const path = require('path'), fs = require('fs');
  const initSqlJs = require('sql.js');
  const dataDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'compras.db');
  const SQL = await initSqlJs();
  const db = fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();
  const save = () => { try { fs.writeFileSync(dbPath, Buffer.from(db.export())); } catch(e) {} };
  const tabelas = [
    `CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, email TEXT NOT NULL UNIQUE, senha_hash TEXT NOT NULL, papel TEXT NOT NULL DEFAULT 'operador', ativo INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')))`,
    `CREATE TABLE IF NOT EXISTS ordens_servico (id INTEGER PRIMARY KEY AUTOINCREMENT, numero_os TEXT NOT NULL UNIQUE, cliente TEXT NOT NULL, equipamento TEXT NOT NULL, data_abertura TEXT NOT NULL, data_conclusao_estimada TEXT, status TEXT NOT NULL DEFAULT 'Aberta', prioridade TEXT NOT NULL DEFAULT 'Média', tipo TEXT NOT NULL DEFAULT 'OS', transporte TEXT, transporte_obs TEXT, observacoes TEXT, criado_por INTEGER, criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')), atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')))`,
    `CREATE TABLE IF NOT EXISTS pecas_os (id INTEGER PRIMARY KEY AUTOINCREMENT, os_id INTEGER NOT NULL, codigo TEXT, descricao TEXT NOT NULL, quantidade INTEGER NOT NULL DEFAULT 1, preco_unitario REAL, preco_cotado REAL, preco_fechado REAL, fornecedor_id INTEGER, status_entrega TEXT NOT NULL DEFAULT 'Pendente', data_entrega_prevista TEXT, numero_rastreio TEXT, observacoes TEXT, transporte TEXT, criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')), atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')))`,
    `CREATE TABLE IF NOT EXISTS fornecedores (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, cnpj TEXT, contato TEXT, telefone TEXT, email TEXT, cidade TEXT, estado TEXT, observacoes TEXT, criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')))`,
    `CREATE TABLE IF NOT EXISTS historico_status (id INTEGER PRIMARY KEY AUTOINCREMENT, os_id INTEGER NOT NULL, status_anterior TEXT, status_novo TEXT NOT NULL, observacao TEXT, usuario_id INTEGER, criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')))`,
    `CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT NOT NULL, atualizado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')))`,
    `CREATE TABLE IF NOT EXISTS comentarios_peca (id INTEGER PRIMARY KEY AUTOINCREMENT, peca_id INTEGER NOT NULL, usuario_id INTEGER, texto TEXT NOT NULL, criado_em TEXT NOT NULL DEFAULT (datetime('now','localtime')))`,
  ];
  tabelas.forEach(sql => { try { db.run(sql); } catch(e) {} });
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

// ── POSTGRESQL PRODUÇÃO ───────────────────────────────────────────────────
// Usa Atomics + SharedArrayBuffer + worker_threads para chamadas síncronas
function initPostgres() {
  const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
  const os = require('os');
  const path = require('path');
  const fs = require('fs');

  // Script do worker inline (salvo em arquivo temp)
  const workerScript = `
const { parentPort, workerData } = require('worker_threads');
const { Client } = require('pg');

async function run() {
  const { sql, params, connStr } = workerData;
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const result = await client.query(sql, params);
    parentPort.postMessage({ rows: result.rows, rowCount: result.rowCount });
  } catch(e) {
    parentPort.postMessage({ error: e.message });
  } finally {
    await client.end();
  }
}
run();
`;

  const workerFile = path.join(os.tmpdir(), 'pg-worker.js');
  fs.writeFileSync(workerFile, workerScript);

  const connStr = process.env.DATABASE_URL;

  // Executa query de forma síncrona via Atomics
  const querySync = (sql, params = []) => {
    // Converte ? para $1, $2...
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => '$' + (++i));

    const sharedBuffer = new SharedArrayBuffer(4);
    const flag = new Int32Array(sharedBuffer);
    let result = null;

    const worker = new Worker(workerFile, {
      workerData: { sql: pgSql, params, connStr }
    });

    worker.on('message', (msg) => {
      result = msg;
      Atomics.store(flag, 0, 1);
      Atomics.notify(flag, 0);
    });

    worker.on('error', (e) => {
      result = { error: e.message };
      Atomics.store(flag, 0, 1);
      Atomics.notify(flag, 0);
    });

    // Aguarda resultado (máx 15 segundos)
    Atomics.wait(flag, 0, 0, 15000);

    if (!result) throw new Error('PostgreSQL timeout');
    if (result.error) throw new Error(result.error);
    return result;
  };

  const addReturning = (sql) => {
    const upper = sql.trim().toUpperCase();
    if (upper.startsWith('INSERT') && !upper.includes('RETURNING')) {
      return sql.trim() + ' RETURNING id';
    }
    return sql;
  };

  return {
    _tipo: 'postgres',
    prepare(sql) {
      return {
        run(...params) {
          const r = querySync(addReturning(sql), params);
          return { changes: r.rowCount, lastInsertRowid: r.rows[0]?.id || null };
        },
        get(...params) {
          const r = querySync(sql, params);
          return r.rows[0];
        },
        all(...params) {
          const r = querySync(sql, params);
          return r.rows;
        }
      };
    },
    exec(sql) { querySync(sql, []); }
  };
}

// ── API PÚBLICA ────────────────────────────────────────────────────────────
async function initDB() {
  if (_db) return _db;
  if (isProd) {
    console.log('  🌐 Modo produção — PostgreSQL (Supabase)');
    _db = initPostgres();
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
