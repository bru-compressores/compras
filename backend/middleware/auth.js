const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'compras_secret_key_2024';

function autenticar(req, res, next) {
  // Suporte a token via query param (para PDF aberto em nova aba)
  if (!req.headers.authorization && req.query.token) {
    req.headers.authorization = 'Bearer ' + req.query.token;
  }
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Token não fornecido' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.usuario = payload;
    next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

function apenasAdmin(req, res, next) {
  if (req.usuario?.papel !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores' });
  }
  next();
}

module.exports = { autenticar, apenasAdmin, JWT_SECRET };
