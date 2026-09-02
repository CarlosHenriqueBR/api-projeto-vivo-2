'use strict';

/** Teste rapido de ponta a ponta: sobe a API numa porta livre e valida os fluxos. */

const assert = require('node:assert');
const { servidor } = require('../src/server');
const massas = require('../src/massas');

let falhas = 0;

function verificar(descricao, funcao) {
  try {
    funcao();
    console.log(`  ok   ${descricao}`);
  } catch (falha) {
    falhas += 1;
    console.error(`  FALHA ${descricao}\n        ${falha.message}`);
  }
}

async function main() {
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${servidor.address().port}`;

  const registros = massas.listar();
  const porTipo = {
    CPF: registros.find((r) => r.tipo === 'CPF'),
    CNPJ: registros.find((r) => r.tipo === 'CNPJ'),
    CNPJ_ALFANUMERICO: registros.find((r) => r.tipo === 'CNPJ_ALFANUMERICO'),
  };

  for (const [tipo, registro] of Object.entries(porTipo)) {
    const autenticacao = await fetch(`${base}/api/v1/auth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ documento: registro.documentoFormatado, senha: registro.senha }),
    });
    const credenciais = await autenticacao.json();

    verificar(`${tipo}: token emitido`, () => {
      assert.strictEqual(autenticacao.status, 200);
      assert.ok(credenciais.access_token);
      assert.strictEqual(credenciais.tipoDocumento, tipo);
    });

    const consulta = await fetch(`${base}/api/v1/consulta`, {
      headers: { authorization: `Bearer ${credenciais.access_token}` },
    });
    const retorno = await consulta.json();

    verificar(`${tipo}: consulta retorna envelope coerente`, () => {
      assert.strictEqual(consulta.status, 200);
      assert.strictEqual(retorno.statusCode, 200);
      assert.strictEqual(retorno.body.QtdContratos, retorno.body.Cybers.length);

      const totalFaturas = retorno.body.Cybers.reduce((soma, c) => soma + c.Faturas.length, 0);
      assert.strictEqual(retorno.body.QtdFaturasAbertoContratos, totalFaturas);

      const soma = retorno.body.Cybers.reduce((acumulado, c) => acumulado + c.ValorTotalFaturas, 0);
      assert.ok(Math.abs(soma - retorno.body.ValorTotalContratos) < 0.01);

      for (const contrato of retorno.body.Cybers) {
        const somaParcelas = contrato.Faturas.reduce((t, f) => t + f.ValorParcela, 0);
        assert.ok(Math.abs(somaParcelas - contrato.ValorTotalFaturas) < 0.01);
        assert.ok(contrato.Negociacao.length >= 2);
        for (const fatura of contrato.Faturas) {
          assert.match(fatura.LinhaDigitavel, /^\d{48}$/);
        }
      }
    });
  }

  const semToken = await fetch(`${base}/api/v1/consulta`);
  verificar('consulta sem token retorna 401', () => assert.strictEqual(semToken.status, 401));

  const tokenRuim = await fetch(`${base}/api/v1/consulta`, { headers: { authorization: 'Bearer abc.def.ghi' } });
  verificar('token invalido retorna 401', () => assert.strictEqual(tokenRuim.status, 401));

  const docInvalido = await fetch(`${base}/api/v1/auth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ documento: '12.ABC.345/01DE-99' }),
  });
  verificar('CNPJ alfanumerico com DV errado retorna 400', () => assert.strictEqual(docInvalido.status, 400));

  const senhaErrada = await fetch(`${base}/api/v1/auth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ documento: porTipo.CNPJ.documento, senha: 'errada' }),
  });
  verificar('senha errada retorna 401', () => assert.strictEqual(senhaErrada.status, 401));

  const naoCadastrado = await fetch(`${base}/api/v1/auth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ documento: '12.ABC.345/01DE-35' }),
  });
  verificar('documento valido sem cadastro retorna 401', () => assert.strictEqual(naoCadastrado.status, 401));

  const listagem = await fetch(`${base}/api/v1/massas`);
  const lista = await listagem.json();
  verificar('listagem traz 15 massas (5 CPF, 5 CNPJ, 5 alfanumericos)', () => {
    assert.strictEqual(lista.registros.length, 15);
    for (const tipo of ['CPF', 'CNPJ', 'CNPJ_ALFANUMERICO']) {
      assert.strictEqual(lista.registros.filter((r) => r.tipo === tipo).length, 5);
    }
    assert.strictEqual(new Set(lista.registros.map((r) => r.documento)).size, 15);
  });

  servidor.close();
  console.log(falhas === 0 ? '\nTodos os testes passaram.' : `\n${falhas} teste(s) falharam.`);
  process.exit(falhas === 0 ? 0 : 1);
}

main();
