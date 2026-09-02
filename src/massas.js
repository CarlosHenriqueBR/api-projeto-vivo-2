'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { limpar } = require('./documento');

const ARQUIVO = process.env.ARQUIVO_MASSAS
  ? path.resolve(process.env.ARQUIVO_MASSAS)
  : path.join(__dirname, '..', 'data', 'massas.json');

let cache = null;

function carregar() {
  if (cache) return cache;

  if (!fs.existsSync(ARQUIVO)) {
    throw new Error(
      `Arquivo de massas nao encontrado em ${ARQUIVO}. Rode "npm run gerar-massas" antes de subir a API.`
    );
  }

  const conteudo = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'));
  const indice = new Map();
  for (const registro of conteudo.registros) {
    indice.set(limpar(registro.documento), registro);
  }

  cache = { ...conteudo, indice, arquivo: ARQUIVO };
  return cache;
}

function recarregar() {
  cache = null;
  return carregar();
}

function buscar(documento) {
  return carregar().indice.get(limpar(documento)) || null;
}

function listar() {
  return carregar().registros.map((registro) => ({
    id: registro.id,
    tipo: registro.tipo,
    documento: registro.documento,
    documentoFormatado: registro.documentoFormatado,
    nome: registro.nome,
    senha: registro.senha,
    resumo: {
      QtdContratos: registro.body.QtdContratos,
      QtdFaturasAbertoContratos: registro.body.QtdFaturasAbertoContratos,
      ValorTotalContratos: registro.body.ValorTotalContratos,
    },
  }));
}

function metadados() {
  const dados = carregar();
  return {
    arquivo: dados.arquivo,
    geradoEm: dados.geradoEm,
    dataReferencia: dados.dataReferencia,
    seed: dados.seed,
    totalRegistros: dados.totalRegistros,
  };
}

module.exports = { buscar, listar, metadados, recarregar };
