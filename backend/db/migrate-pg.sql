-- ============================================================
-- BRU Compressores — Controle de Compras
-- Script de migração para PostgreSQL (Supabase)
-- Execute este SQL no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'operador',
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ordens_servico (
  id SERIAL PRIMARY KEY,
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
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pecas_os (
  id SERIAL PRIMARY KEY,
  os_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  codigo TEXT,
  descricao TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario NUMERIC,
  preco_cotado NUMERIC,
  preco_fechado NUMERIC,
  fornecedor_id INTEGER,
  status_entrega TEXT NOT NULL DEFAULT 'Pendente',
  data_entrega_prevista TEXT,
  numero_rastreio TEXT,
  observacoes TEXT,
  transporte TEXT,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fornecedores (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT,
  contato TEXT,
  telefone TEXT,
  email TEXT,
  cidade TEXT,
  estado TEXT,
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historico_status (
  id SERIAL PRIMARY KEY,
  os_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  observacao TEXT,
  usuario_id INTEGER,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comentarios_peca (
  id SERIAL PRIMARY KEY,
  peca_id INTEGER NOT NULL REFERENCES pecas_os(id) ON DELETE CASCADE,
  usuario_id INTEGER,
  texto TEXT NOT NULL,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Usuário admin padrão (senha: admin123)
INSERT INTO usuarios (nome, email, senha_hash, papel)
VALUES ('Administrador', 'admin@empresa.com', '$2a$10$rOzJqnvZoTz6nKxFvnLZKO1n7MHt1.h.q3.K/5WpVGQjXFJx6P9Qm', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Adicionar código do fabricante (rodar no Supabase SQL Editor se já existir banco)
ALTER TABLE pecas_os ADD COLUMN IF NOT EXISTS codigo_fabricante TEXT;
