'use strict';

/**
 * Gera massas ficticias de teste no formato da API de dividas.
 *
 *   node scripts/gerar-massas.js [--base=AAAA-MM-DD] [--seed=12345]
 *
 * Sao geradas 15 massas: 5 CPF, 5 CNPJ numerico e 5 CNPJ alfanumerico.
 * Todos os documentos possuem digitos verificadores validos e todos os
 * totais (valores, quantidades e dias de atraso) sao coerentes entre si.
 */

const fs = require('node:fs');
const path = require('node:path');
const { calcularDvCpf, calcularDvCnpj, formatar, TIPOS } = require('../src/documento');

// ---------------------------------------------------------------- utilitarios

function lerArgumento(nome, padrao) {
  const encontrado = process.argv.slice(2).find((arg) => arg.startsWith(`--${nome}=`));
  return encontrado ? encontrado.split('=').slice(1).join('=') : padrao;
}

/** PRNG deterministico (mulberry32) para que a massa seja reproduzivel. */
function criarRandom(seed) {
  let estado = seed >>> 0;
  return function random() {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = Number(lerArgumento('seed', '20260824'));
const random = criarRandom(SEED);

const inteiro = (min, max) => min + Math.floor(random() * (max - min + 1));
const escolher = (lista) => lista[inteiro(0, lista.length - 1)];
const r2 = (valor) => Math.round(valor * 100) / 100;
const digitos = (quantidade) => Array.from({ length: quantidade }, () => inteiro(0, 9)).join('');

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALFANUM = `0123456789${LETRAS}`;

// ---------------------------------------------------------------------- datas

const BASE_ISO = lerArgumento('base', new Date().toISOString().slice(0, 10));
const [ANO_BASE, MES_BASE, DIA_BASE] = BASE_ISO.split('-').map(Number);
const BASE = new Date(Date.UTC(ANO_BASE, MES_BASE - 1, DIA_BASE));

const DIA_MS = 24 * 60 * 60 * 1000;
const pad2 = (valor) => String(valor).padStart(2, '0');

function somarMeses(data, meses) {
  const nova = new Date(data.getTime());
  const diaDesejado = nova.getUTCDate();
  nova.setUTCDate(1);
  nova.setUTCMonth(nova.getUTCMonth() + meses);
  const ultimoDia = new Date(Date.UTC(nova.getUTCFullYear(), nova.getUTCMonth() + 1, 0)).getUTCDate();
  nova.setUTCDate(Math.min(diaDesejado, ultimoDia));
  return nova;
}

function comDia(data, dia) {
  const ultimoDia = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), Math.min(dia, ultimoDia)));
}

const formatarData = (data) =>
  `${pad2(data.getUTCDate())}/${pad2(data.getUTCMonth() + 1)}/${data.getUTCFullYear()}`;

const diasEntre = (inicio, fim) => Math.round((fim.getTime() - inicio.getTime()) / DIA_MS);

// ----------------------------------------------------------------- documentos

function gerarCpf() {
  let base = digitos(9);
  while (/^(.)\1+$/.test(base)) base = digitos(9);
  return base + calcularDvCpf(base);
}

function gerarCnpjNumerico() {
  const base = digitos(8) + pad2(0) + pad2(inteiro(1, 4)); // raiz + ordem (0001..0004)
  return base + calcularDvCnpj(base);
}

function gerarCnpjAlfanumerico() {
  // Raiz alfanumerica (8) + ordem alfanumerica (4), conforme IN RFB 2.229/2024.
  let raiz = '';
  for (let i = 0; i < 8; i += 1) raiz += escolher(ALFANUM.split(''));
  if (!/[A-Z]/.test(raiz)) raiz = escolher(LETRAS.split('')) + raiz.slice(1);
  const ordem = `${inteiro(0, 9)}${inteiro(0, 9)}${escolher(LETRAS.split(''))}${escolher(LETRAS.split(''))}`;
  const base = raiz + ordem;
  return base + calcularDvCnpj(base);
}

function gerarUnico(fabrica, usados) {
  let documento = fabrica();
  while (usados.has(documento)) documento = fabrica();
  usados.add(documento);
  return documento;
}

// --------------------------------------------------------------- dados falsos

const NOMES_PF = [
  'Aurelio Prado Bittencourt',
  'Marisa Colaco Ferreira',
  'Tulio Vasques Andrade',
  'Neide Camargo Portela',
  'Ivan Bragancao Mesquita',
];

const EMPRESAS_PJ = [
  'Corveta Distribuidora de Alimentos LTDA',
  'Pantanal Solucoes em Logistica ME',
  'Vertigo Comercio de Autopecas LTDA',
  'Serra Azul Servicos de Limpeza EIRELI',
  'Marejo Industria de Embalagens SA',
];

const EMPRESAS_ALFA = [
  'Quaresma Tecnologia e Inovacao LTDA',
  'Arauto Servicos Financeiros SA',
  'Bromelia Agroindustrial LTDA',
  'Nimbus Data Center Servicos SA',
  'Cerrado Mobilidade Urbana LTDA',
];

const BILLINGS = ['AMD', 'ABR', 'CRT', 'SGT', 'VVO'];

const PRODUTOS_PF = [null, 'MOVEL_CONTROLE', 'FIXA_RESIDENCIAL', 'FIBRA_500MB', 'MOVEL_POS_PAGO'];
const PRODUTOS_PJ = [null, 'MOVEL_EMPRESAS', 'FIBRA_EMPRESAS_1GB', 'LINK_DEDICADO', 'PABX_VIRTUAL'];

const DDDS = ['11', '21', '31', '41', '51', '61', '71', '81'];

const telefone = () => `${escolher(DDDS)}9${digitos(4)}${digitos(4)}`;

// ------------------------------------------------------------ montagem massas

function gerarLinhaDigitavel(valor, contratoNumerico, vencimento) {
  const centavos = String(Math.round(valor * 100)).padStart(8, '0');
  const bruta =
    '846' +
    inteiro(0, 9) +
    '00000' +
    centavos +
    '02951' +
    pad2(inteiro(0, 3)) +
    contratoNumerico +
    '19' +
    String(vencimento.getUTCFullYear()).slice(2) +
    pad2(vencimento.getUTCMonth() + 1) +
    digitos(48);
  return bruta.slice(0, 48);
}

function gerarFaturas(contratoNumerico, quantidade, pessoaFisica) {
  // Ultimo vencimento entre 1 e 3 meses antes da data base (faturas em atraso).
  const mesesDesdeUltima = inteiro(1, 3);
  const diaVencimento = escolher([5, 10, 15, 20, 26]);
  const faturas = [];

  for (let i = quantidade - 1; i >= 0; i -= 1) {
    const vencimento = comDia(somarMeses(BASE, -(mesesDesdeUltima + i)), diaVencimento);
    const valor = pessoaFisica
      ? r2(inteiro(3500, 32000) / 100)
      : r2(inteiro(12000, 480000) / 100);

    faturas.push({
      ValorParcela: valor,
      MesVencimento: pad2(vencimento.getUTCMonth() + 1),
      DataVencimento: formatarData(vencimento),
      LinhaDigitavel: gerarLinhaDigitavel(valor, contratoNumerico, vencimento),
      _vencimento: vencimento,
    });
  }

  return faturas;
}

let sequenciaPolitica = 11650080;

function gerarNegociacao(valorTotal) {
  const vencimentoAcordo = new Date(BASE.getTime() + inteiro(7, 15) * DIA_MS);
  const dataVencimento = formatarData(vencimentoAcordo);
  const limite = random() < 0.4 ? formatarData(new Date(vencimentoAcordo.getTime() + 15 * DIA_MS)) : null;
  const opcoes = [];

  // Opcao a vista, com desconto.
  const desconto = escolher([5, 10, 15, 20, 25]);
  sequenciaPolitica += 1;
  opcoes.push({
    QtdParcelas: 0,
    PercDesconto: desconto,
    DataVencimento: dataVencimento,
    DataVencimentoLimite: limite,
    ValorEntrada: 0,
    ValorMinEntrada: 0,
    PercentualEntradaMinima: 0,
    ValorParcela: 0,
    ValorTotal: r2(valorTotal * (1 - desconto / 100)),
    ValorCorrigido: 0,
    IdPolitica: sequenciaPolitica,
    PercentualEntrada: 100,
    PoliticaAtento: true,
  });

  // Opcoes parceladas, sem desconto.
  const parcelamentos = [];
  const quantidadeOpcoes = inteiro(1, 3);
  while (parcelamentos.length < quantidadeOpcoes) {
    const parcelas = escolher([1, 2, 3, 4, 6]);
    if (!parcelamentos.includes(parcelas)) parcelamentos.push(parcelas);
  }
  parcelamentos.sort((a, b) => a - b);

  for (const parcelas of parcelamentos) {
    const percentualEntrada = parcelas === 1 ? 50 : escolher([20, 30, 40]);
    const valorEntrada = r2(valorTotal * (percentualEntrada / 100));
    const valorParcela = r2((valorTotal - valorEntrada) / parcelas);
    sequenciaPolitica += 1;
    opcoes.push({
      QtdParcelas: parcelas,
      PercDesconto: 0,
      DataVencimento: dataVencimento,
      DataVencimentoLimite: limite,
      ValorEntrada: valorEntrada,
      ValorMinEntrada: valorEntrada,
      PercentualEntradaMinima: 0,
      ValorParcela: valorParcela,
      ValorTotal: r2(valorTotal),
      ValorCorrigido: 0,
      IdPolitica: sequenciaPolitica,
      PercentualEntrada: percentualEntrada,
      PoliticaAtento: true,
    });
  }

  return opcoes;
}

function gerarContrato(pessoaFisica) {
  const contratoNumerico = digitos(10);
  const billing = escolher(BILLINGS);
  const faturas = gerarFaturas(contratoNumerico, inteiro(1, 4), pessoaFisica);

  const valorTotalFaturas = r2(faturas.reduce((soma, fatura) => soma + fatura.ValorParcela, 0));
  const vencimentoMaisAntigo = faturas[0]._vencimento;

  return {
    ContratoOriginal: `${contratoNumerico}-${billing}`,
    Billing: billing,
    QtdDiasAtraso: diasEntre(vencimentoMaisAntigo, BASE),
    QtdFaturasAberto: faturas.length,
    ValorTotalFaturas: valorTotalFaturas,
    Produto: escolher(pessoaFisica ? PRODUTOS_PF : PRODUTOS_PJ),
    TelDivida: random() < 0.5 ? telefone() : null,
    Faturas: faturas.map(({ _vencimento, ...fatura }) => fatura),
    Negociacao: gerarNegociacao(valorTotalFaturas),
  };
}

function gerarBody(pessoaFisica) {
  const cybers = Array.from({ length: inteiro(1, 3) }, () => gerarContrato(pessoaFisica));

  return {
    ValorTotalContratos: r2(cybers.reduce((soma, c) => soma + c.ValorTotalFaturas, 0)),
    QtdFaturasAbertoContratos: cybers.reduce((soma, c) => soma + c.QtdFaturasAberto, 0),
    QtdContratos: cybers.length,
    GlobalOnes: [],
    Cybers: cybers,
    Rpa: [],
  };
}

// -------------------------------------------------------------------- geracao

const usados = new Set();
const registros = [];

function adicionar(tipo, fabrica, nome, indice) {
  const documento = gerarUnico(fabrica, usados);
  const pessoaFisica = tipo === TIPOS.CPF;
  registros.push({
    id: `${tipo.toLowerCase()}-${indice + 1}`,
    documento,
    documentoFormatado: formatar(documento, tipo),
    tipo,
    nome,
    senha: `Vivo@${documento.slice(-4)}`,
    body: gerarBody(pessoaFisica),
  });
}

NOMES_PF.forEach((nome, i) => adicionar(TIPOS.CPF, gerarCpf, nome, i));
EMPRESAS_PJ.forEach((nome, i) => adicionar(TIPOS.CNPJ, gerarCnpjNumerico, nome, i));
EMPRESAS_ALFA.forEach((nome, i) => adicionar(TIPOS.CNPJ_ALFANUMERICO, gerarCnpjAlfanumerico, nome, i));

const saida = {
  geradoEm: new Date().toISOString(),
  dataReferencia: BASE_ISO,
  seed: SEED,
  totalRegistros: registros.length,
  registros,
};

const destino = path.join(__dirname, '..', 'data', 'massas.json');
fs.writeFileSync(destino, `${JSON.stringify(saida, null, 2)}\n`, 'utf8');

console.log(`Massas geradas em ${destino}`);
for (const registro of registros) {
  console.log(
    `  ${registro.tipo.padEnd(19)} ${registro.documentoFormatado.padEnd(20)} ` +
      `contratos=${registro.body.QtdContratos} faturas=${registro.body.QtdFaturasAbertoContratos} ` +
      `total=R$ ${registro.body.ValorTotalContratos.toFixed(2)}`
  );
}
