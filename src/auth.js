'use strict';

const crypto = require('node:crypto');

/** JWT HS256 implementado com o modulo crypto nativo (sem dependencias externas). */

function base64url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function deBase64url(texto) {
  const normalizado = texto.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalizado, 'base64').toString('utf8');
}

function assinar(conteudo, segredo) {
  return base64url(crypto.createHmac('sha256', segredo).update(conteudo).digest());
}

function gerarToken(dados, { segredo, ttlSegundos = 3600 }) {
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const corpo = base64url(
    JSON.stringify({ ...dados, iat: agora, exp: agora + ttlSegundos, jti: crypto.randomUUID() })
  );
  const conteudo = `${cabecalho}.${corpo}`;
  return { token: `${conteudo}.${assinar(conteudo, segredo)}`, expiraEm: ttlSegundos };
}

/**
 * @returns {{valido: boolean, dados?: object, motivo?: string}}
 */
function verificarToken(token, segredo) {
  if (!token || typeof token !== 'string') {
    return { valido: false, motivo: 'token_ausente' };
  }

  const partes = token.split('.');
  if (partes.length !== 3) {
    return { valido: false, motivo: 'token_malformado' };
  }

  const [cabecalho, corpo, assinatura] = partes;
  const esperada = assinar(`${cabecalho}.${corpo}`, segredo);

  const recebidaBuf = Buffer.from(assinatura);
  const esperadaBuf = Buffer.from(esperada);
  if (recebidaBuf.length !== esperadaBuf.length || !crypto.timingSafeEqual(recebidaBuf, esperadaBuf)) {
    return { valido: false, motivo: 'assinatura_invalida' };
  }

  let dados;
  try {
    dados = JSON.parse(deBase64url(corpo));
  } catch {
    return { valido: false, motivo: 'token_malformado' };
  }

  if (typeof dados.exp !== 'number' || dados.exp < Math.floor(Date.now() / 1000)) {
    return { valido: false, motivo: 'token_expirado' };
  }

  return { valido: true, dados };
}

/** Extrai o token do header "Authorization: Bearer <token>". */
function extrairBearer(headerAuthorization) {
  if (!headerAuthorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(String(headerAuthorization).trim());
  return match ? match[1].trim() : null;
}

module.exports = { gerarToken, verificarToken, extrairBearer };
