/**
 * database.js — Abstração do banco de dados
 * Local: SQLite via sql.js
 * Produção: PostgreSQL via Supabase
 * 
 * Interface unificada: todas as rotas usam db.prepare(sql).run/get/all
 * Em produção, essas chamadas são síncronas via deasync
 */

const isProd = !!process.env.DATABASE_URL;
let _db = null;

// ── SQLITE LOCAL ──────────────────────────────────────────────────────────
async function initSQLite() {
  const path      = require('path');
  const fs        = require('fs');
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

  const save = () => {
    try { fs.writeFileSync(dbPath, Buffer.from(db.export())); } catch(e) {}
  };

  // Criar tabelas
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
// Usa pg com execução síncrona via Atomics/SharedArrayBuffer trick
// Abordagem: executa queries de forma síncrona bloqueando com worker threads

function initPostgres() {
  const { Pool } = require('pg');
  const { execSync } = require('child_process');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10
  });

  // Converte ? para $1, $2...
  const convertPlaceholders = (sql) => {
    let i = 0;
    return sql.replace(/\?/g, () => '$' + (++i));
  };

  // Executa query de forma SÍNCRONA usando script filho
  const querySync = (sql, params = []) => {
    const pgSql = convertPlaceholders(sql);
    const input = JSON.stringify({ sql: pgSql, params, connStr: process.env.DATABASE_URL });
    
    try {
      const result = execSync(
        `node -e "
const {Client}=require('pg');
const input=${JSON.stringify(input)};
const {sql,params,connStr}=JSON.parse(input);
const c=new Client({connectionString:connStr,ssl:{rejectUnauthorized:false}});
c.connect().then(()=>c.query(sql,params)).then(r=>{ process.stdout.write(JSON.stringify({rows:r.rows,rowCount:r.rowCount})); c.end(); }).catch(e=>{ process.stdout.write(JSON.stringify({error:e.message})); c.end(); });
"`,
        { timeout: 10000, maxBuffer: 10 * 1024 * 1024 }
      );
      const parsed = JSON.parse(result.toString());
      if (parsed.error) throw new Error(parsed.error);
      return parsed;
    } catch(e) {
      if (e.stdout) {
        const out = JSON.parse(e.stdout.toString());
        if (out.error) throw new Error(out.error);
        return out;
      }
      throw e;
    }
  };

  return {
    _tipo: 'postgres',
    _pool: pool,
    prepare(sql) {
      return {
        run(...params) {
          const pgSql = convertPlaceholders(sql) + (sql.toUpperCase().includes('INSERT') ? ' RETURNING id' : '');
          const r = querySync(pgSql, params);
          return { changes: r.rowCount, lastInsertRowid: r.rows[0]?.id || null };
        },
        get(...params) {
          const r = querySync(convertPlaceholders(sql), params);
          return r.rows[0];
        },
        all(...params) {
          const r = querySync(convertPlaceholders(sql), params);
          return r.rows;
        }
      };
    },
    exec(sql) {
      querySync(sql, []);
    }
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
