'use strict';

/**
 * Executa a collection do Postman contra a API que estiver no ar, incluindo os
 * scripts da aba "Tests" de cada requisicao (implementacao minima do objeto pm).
 *
 *   node scripts/rodar-postman.js [--baseUrl=http://127.0.0.1:3333]
 *
 * Serve como alternativa ao Newman quando nao se quer instalar nada.
 */

const vm = require('node:vm');
const path = require('node:path');

const colecao = require('../postman/api-projeto-vivo.postman_collection.json');
const ambiente = require('../postman/local.postman_environment.json');

const variaveis = new Map();
for (const item of ambiente.values) variaveis.set(item.key, item.value);
for (const item of colecao.variable) variaveis.set(item.key, item.value);

const argBaseUrl = process.argv.slice(2).find((a) => a.startsWith('--baseUrl='));
if (argBaseUrl) variaveis.set('baseUrl', argBaseUrl.split('=').slice(1).join('='));

const resolver = (texto) =>
  String(texto).replace(/{{(\w+)}}/g, (bruto, chave) => (variaveis.has(chave) ? variaveis.get(chave) : bruto));

let totalTestes = 0;
let falhas = 0;

/** Shim minimo do objeto `pm` usado pelos scripts da collection. */
function criarPm(resposta, textoResposta) {
  const expect = (valor) => ({
    to: {
      be: {
        a(tipo) {
          if (typeof valor !== tipo) throw new Error(`esperava tipo ${tipo}, veio ${typeof valor}`);
        },
      },
      eql(esperado) {
        if (valor !== esperado) throw new Error(`esperava ${esperado}, veio ${valor}`);
      },
    },
  });

  return {
    expect,
    response: {
      code: resposta.status,
      json: () => JSON.parse(textoResposta),
      text: () => textoResposta,
      to: {
        have: {
          status(esperado) {
            if (resposta.status !== esperado) {
              throw new Error(`esperava status ${esperado}, veio ${resposta.status}`);
            }
          },
        },
      },
    },
    collectionVariables: {
      set: (chave, valor) => variaveis.set(chave, valor),
      get: (chave) => variaveis.get(chave),
    },
    environment: {
      set: (chave, valor) => variaveis.set(chave, valor),
      get: (chave) => variaveis.get(chave),
    },
    test(descricao, funcao) {
      totalTestes += 1;
      try {
        funcao();
        console.log(`      teste: ${descricao} — passou`);
      } catch (falha) {
        falhas += 1;
        console.log(`      teste: ${descricao} — FALHOU (${falha.message})`);
      }
    },
  };
}

async function executarItem(item, pasta) {
  const req = item.request;
  const url = resolver(req.url.raw);
  const headers = {};
  for (const cabecalho of req.header || []) headers[cabecalho.key] = resolver(cabecalho.value);
  if (req.auth?.type === 'bearer') {
    headers.authorization = `Bearer ${resolver(req.auth.bearer[0].value)}`;
  }

  const inicio = Date.now();
  let resposta;
  let texto;
  try {
    resposta = await fetch(url, {
      method: req.method,
      headers,
      body: req.body ? resolver(req.body.raw) : undefined,
    });
    texto = await resposta.text();
  } catch (falha) {
    falhas += 1;
    console.log(`  FALHA ${req.method} ${item.name} -> sem resposta (${falha.message})`);
    return;
  }
  const duracao = Date.now() - inicio;

  const tipo = resposta.headers.get('content-type') || '';
  const ehJson = tipo.includes('application/json');
  if (!ehJson) {
    falhas += 1;
    console.log(`  FALHA ${req.method} ${item.name} -> content-type ${tipo} (esperado JSON; a porta pode estar com outra aplicacao)`);
    return;
  }

  console.log(`  ${resposta.status}  ${req.method.padEnd(4)} ${item.name}  (${duracao}ms, ${texto.length} bytes)`);

  const script = (item.event || []).find((evento) => evento.listen === 'test');
  if (script) {
    const pm = criarPm(resposta, texto);
    const contexto = vm.createContext({ pm, console: { log: () => {} } });
    try {
      vm.runInContext(script.script.exec.join('\n'), contexto, { filename: `${pasta}/${item.name}` });
    } catch (falha) {
      falhas += 1;
      console.log(`      erro no script de teste: ${falha.message}`);
    }
  }
}

(async () => {
  console.log(`Collection: ${colecao.info.name}`);
  console.log(`baseUrl:    ${variaveis.get('baseUrl')}\n`);

  for (const pasta of colecao.item) {
    console.log(`# ${pasta.name}`);
    for (const item of pasta.item) {
      await executarItem(item, pasta.name);
    }
    console.log('');
  }

  const total = colecao.item.reduce((soma, pasta) => soma + pasta.item.length, 0);
  console.log(`${total} requisicoes, ${totalTestes} asserts, ${falhas} falha(s).`);
  process.exit(falhas === 0 ? 0 : 1);
})();
