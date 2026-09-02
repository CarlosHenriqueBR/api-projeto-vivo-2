'use strict';

const http = require('node:http');
const { identificar, TIPOS } = require('./documento');
const { gerarToken, verificarToken, extrairBearer } = require('./auth');
const massas = require('./massas');

const PORTA = Number(process.env.PORT || 3333);
// 0.0.0.0 e obrigatorio em PaaS (Render, Railway, Fly). Localmente funciona igual.
const HOST = process.env.HOST || '0.0.0.0';
const SEGREDO_PADRAO = 'segredo-local-projeto-vivo';
const SEGREDO = process.env.API_SECRET || SEGREDO_PADRAO;
const TTL = Number(process.env.TOKEN_TTL || 3600);
// Quando "true", a senha do registro passa a ser obrigatoria no /auth/token.
const EXIGIR_SENHA = String(process.env.EXIGIR_SENHA || 'false').toLowerCase() === 'true';
// Endpoint auxiliar que lista as massas (util em ambiente local, desligue em outros).
const EXPOR_MASSAS = String(process.env.EXPOR_MASSAS || 'true').toLowerCase() === 'true';

// --------------------------------------------------------------- helpers HTTP

function responder(res, status, corpo) {
  const texto = JSON.stringify(corpo, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(texto),
    'cache-control': 'no-store',
  });
  res.end(texto);
}

function erro(res, status, codigo, mensagem, extras = {}) {
  responder(res, status, { statusCode: status, erro: codigo, mensagem, ...extras });
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    const partes = [];
    let tamanho = 0;

    req.on('data', (parte) => {
      tamanho += parte.length;
      if (tamanho > 1_000_000) {
        reject(Object.assign(new Error('payload_muito_grande'), { codigo: 'payload_muito_grande' }));
        req.destroy();
        return;
      }
      partes.push(parte);
    });

    req.on('end', () => {
      const bruto = Buffer.concat(partes).toString('utf8').trim();
      if (!bruto) return resolve({});
      try {
        resolve(JSON.parse(bruto));
      } catch {
        reject(Object.assign(new Error('json_invalido'), { codigo: 'json_invalido' }));
      }
    });

    req.on('error', reject);
  });
}

/** Monta o envelope no mesmo formato retornado pelo backend original. */
function envelope(body) {
  const texto = JSON.stringify(body);
  return {
    statusCode: 200,
    body,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      server: 'Microsoft-IIS/8.5',
      'x-powered-by': 'ASP.NET',
      date: new Date().toUTCString(),
      connection: 'close',
      'content-length': String(Buffer.byteLength(texto)),
    },
  };
}

function autenticar(req, res) {
  const token = extrairBearer(req.headers.authorization);
  const resultado = verificarToken(token, SEGREDO);

  if (!resultado.valido) {
    erro(res, 401, resultado.motivo, 'Token ausente, invalido ou expirado. Chame POST /api/v1/auth/token.');
    return null;
  }

  return resultado.dados;
}

// ----------------------------------------------------------------- endpoints

async function postToken(req, res) {
  const corpo = await lerCorpo(req);
  const documentoInformado = corpo.documento ?? corpo.cnpj ?? corpo.cpf ?? corpo.login;

  const identificado = identificar(documentoInformado);
  if (!identificado.valido) {
    return erro(res, 400, identificado.motivo, 'Documento invalido. Informe CPF, CNPJ numerico ou CNPJ alfanumerico valido.', {
      documento: identificado.documento || null,
      tipoDetectado: identificado.tipo || null,
    });
  }

  const registro = massas.buscar(identificado.documento);
  if (!registro) {
    return erro(res, 401, 'documento_nao_autorizado', 'Documento valido, porem sem cadastro nesta base de massas.', {
      documento: identificado.formatado,
      tipo: identificado.tipo,
    });
  }

  const senhaInformada = corpo.senha ?? corpo.password ?? corpo.secret;
  if ((EXIGIR_SENHA || senhaInformada != null) && senhaInformada !== registro.senha) {
    return erro(res, 401, 'credenciais_invalidas', 'Senha invalida para o documento informado.');
  }

  const { token, expiraEm } = gerarToken(
    {
      sub: registro.documento,
      tipo: registro.tipo,
      nome: registro.nome,
      escopo: 'consulta:dividas',
    },
    { segredo: SEGREDO, ttlSegundos: TTL }
  );

  return responder(res, 200, {
    access_token: token,
    token_type: 'Bearer',
    expires_in: expiraEm,
    escopo: 'consulta:dividas',
    documento: registro.documento,
    documentoFormatado: registro.documentoFormatado,
    tipoDocumento: registro.tipo,
    nome: registro.nome,
  });
}

function getConsulta(req, res, documentoDaRota) {
  const sessao = autenticar(req, res);
  if (!sessao) return undefined;

  let documento = sessao.sub;

  if (documentoDaRota) {
    const identificado = identificar(documentoDaRota);
    if (!identificado.valido) {
      return erro(res, 400, identificado.motivo, 'Documento invalido na rota.');
    }
    if (identificado.documento !== sessao.sub) {
      return erro(res, 403, 'documento_divergente', 'O token nao pertence ao documento informado na rota.');
    }
    documento = identificado.documento;
  }

  const registro = massas.buscar(documento);
  if (!registro) {
    return erro(res, 404, 'massa_nao_encontrada', 'Nenhuma massa cadastrada para o documento do token.');
  }

  return responder(res, 200, envelope(registro.body));
}

function getMassas(req, res) {
  if (!EXPOR_MASSAS) {
    return erro(res, 404, 'nao_encontrado', 'Endpoint desabilitado (EXPOR_MASSAS=false).');
  }
  return responder(res, 200, { ...massas.metadados(), registros: massas.listar() });
}

function postValidar(req, res, corpo) {
  const identificado = identificar(corpo.documento ?? corpo.cnpj ?? corpo.cpf);
  const cadastrado = identificado.valido ? Boolean(massas.buscar(identificado.documento)) : false;
  return responder(res, 200, { ...identificado, cadastrado, tipos: Object.values(TIPOS) });
}

// -------------------------------------------------------------------- roteador

const ROTA_CONSULTA = /^\/api\/v1\/consulta(?:\/([0-9A-Za-z.\-/]+))?$/;

async function rotear(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const caminho = url.pathname.replace(/\/+$/, '') || '/';
  const metodo = req.method.toUpperCase();

  if (metodo === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    });
    return res.end();
  }

  if (metodo === 'GET' && (caminho === '/' || caminho === '/health')) {
    return responder(res, 200, {
      status: 'ok',
      servico: 'api-projeto-vivo (mock local)',
      exigeSenha: EXIGIR_SENHA,
      massas: massas.metadados(),
      endpoints: [
        'POST /api/v1/auth/token',
        'POST /api/v1/documentos/validar',
        'GET  /api/v1/consulta',
        'GET  /api/v1/consulta/{documento}',
        'GET  /api/v1/massas',
      ],
    });
  }

  if (metodo === 'POST' && caminho === '/api/v1/auth/token') {
    return postToken(req, res);
  }

  if (metodo === 'POST' && caminho === '/api/v1/documentos/validar') {
    return postValidar(req, res, await lerCorpo(req));
  }

  if (metodo === 'GET' && caminho === '/api/v1/massas') {
    return getMassas(req, res);
  }

  const consulta = ROTA_CONSULTA.exec(caminho);
  if (consulta && metodo === 'GET') {
    return getConsulta(req, res, consulta[1]);
  }

  return erro(res, 404, 'rota_nao_encontrada', `Rota ${metodo} ${caminho} nao existe.`);
}

const servidor = http.createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  const inicio = Date.now();

  res.on('finish', () => {
    console.log(`${req.method} ${req.url} -> ${res.statusCode} (${Date.now() - inicio}ms)`);
  });

  rotear(req, res).catch((falha) => {
    if (falha && falha.codigo === 'json_invalido') {
      return erro(res, 400, 'json_invalido', 'Corpo da requisicao nao e um JSON valido.');
    }
    if (falha && falha.codigo === 'payload_muito_grande') {
      return erro(res, 413, 'payload_muito_grande', 'Corpo da requisicao excede 1 MB.');
    }
    console.error(falha);
    return erro(res, 500, 'erro_interno', 'Falha inesperada ao processar a requisicao.');
  });
});

if (require.main === module) {
  servidor.on('error', (falha) => {
    if (falha.code === 'EADDRINUSE') {
      console.error(
        `\nA porta ${PORTA} ja esta em uso por outra aplicacao.\n` +
          `Suba a API em outra porta, por exemplo:  PORT=4000 npm start\n` +
          `(e ajuste a variavel baseUrl no Postman para http://127.0.0.1:4000)\n`
      );
      process.exit(1);
    }
    throw falha;
  });

  servidor.listen(PORTA, HOST, () => {
    const meta = massas.metadados();
    console.log(`API no ar em http://${HOST}:${PORTA}`);
    console.log(`Massas: ${meta.totalRegistros} registros (referencia ${meta.dataReferencia})`);
    console.log(`Senha obrigatoria: ${EXIGIR_SENHA ? 'sim' : 'nao (opcional)'}`);
    console.log(`Massas expostas em /api/v1/massas: ${EXPOR_MASSAS ? 'sim' : 'nao'}`);

    if (SEGREDO === SEGREDO_PADRAO) {
      console.warn('AVISO: API_SECRET nao definida, usando o segredo padrao. Defina API_SECRET no ambiente.');
    }
  });

  // Render/PaaS enviam SIGTERM em deploy e shutdown: encerra sem derrubar requisicoes em curso.
  for (const sinal of ['SIGTERM', 'SIGINT']) {
    process.on(sinal, () => {
      console.log(`${sinal} recebido, encerrando o servidor...`);
      servidor.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 10_000).unref();
    });
  }
}

module.exports = { servidor };
