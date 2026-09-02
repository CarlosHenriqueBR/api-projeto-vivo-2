'use strict';

/**
 * Validacao de documentos:
 *  - CPF            -> 11 digitos, DV modulo 11
 *  - CNPJ numerico  -> 14 digitos, DV modulo 11
 *  - CNPJ alfanumerico (IN RFB 2.229/2024) -> 12 caracteres [0-9A-Z] + 2 digitos verificadores.
 *    O valor de cada caractere no calculo do DV e (codigo ASCII - 48):
 *    '0'..'9' => 0..9   |   'A'..'Z' => 17..42
 */

const PESOS_CPF_1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CPF_2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

const TIPOS = {
  CPF: 'CPF',
  CNPJ: 'CNPJ',
  CNPJ_ALFANUMERICO: 'CNPJ_ALFANUMERICO',
};

function limpar(valor) {
  return String(valor == null ? '' : valor)
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');
}

function todosIguais(texto) {
  return /^(.)\1+$/.test(texto);
}

function valorCaractere(caractere) {
  return caractere.charCodeAt(0) - 48;
}

function dvModulo11(valores, pesos) {
  let soma = 0;
  for (let i = 0; i < pesos.length; i += 1) {
    soma += valores[i] * pesos[i];
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function calcularDvCpf(base9) {
  const valores = base9.split('').map(Number);
  const dv1 = dvModulo11(valores, PESOS_CPF_1);
  const dv2 = dvModulo11(valores.concat(dv1), PESOS_CPF_2);
  return `${dv1}${dv2}`;
}

/** Serve tanto para CNPJ numerico quanto alfanumerico (base = 12 caracteres). */
function calcularDvCnpj(base12) {
  const valores = base12.split('').map(valorCaractere);
  const dv1 = dvModulo11(valores, PESOS_CNPJ_1);
  const dv2 = dvModulo11(valores.concat(dv1), PESOS_CNPJ_2);
  return `${dv1}${dv2}`;
}

function validarCpf(documento) {
  if (!/^\d{11}$/.test(documento)) return false;
  if (todosIguais(documento)) return false;
  return calcularDvCpf(documento.slice(0, 9)) === documento.slice(9);
}

function validarCnpj(documento) {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(documento)) return false;
  if (todosIguais(documento)) return false;
  return calcularDvCnpj(documento.slice(0, 12)) === documento.slice(12);
}

function ehAlfanumerico(documento) {
  return /[A-Z]/.test(documento);
}

function formatar(documento, tipo) {
  if (tipo === TIPOS.CPF) {
    return documento.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return documento.replace(
    /^([0-9A-Z]{2})([0-9A-Z]{3})([0-9A-Z]{3})([0-9A-Z]{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

/**
 * @returns {{valido: boolean, documento: string, tipo?: string, formatado?: string, motivo?: string}}
 */
function identificar(valorBruto) {
  const documento = limpar(valorBruto);

  if (!documento) {
    return { valido: false, documento, motivo: 'documento_nao_informado' };
  }

  if (documento.length === 11) {
    return validarCpf(documento)
      ? { valido: true, documento, tipo: TIPOS.CPF, formatado: formatar(documento, TIPOS.CPF) }
      : { valido: false, documento, tipo: TIPOS.CPF, motivo: 'cpf_invalido' };
  }

  if (documento.length === 14) {
    const tipo = ehAlfanumerico(documento) ? TIPOS.CNPJ_ALFANUMERICO : TIPOS.CNPJ;
    return validarCnpj(documento)
      ? { valido: true, documento, tipo, formatado: formatar(documento, tipo) }
      : { valido: false, documento, tipo, motivo: 'cnpj_invalido' };
  }

  return { valido: false, documento, motivo: 'tamanho_invalido' };
}

module.exports = {
  TIPOS,
  limpar,
  formatar,
  identificar,
  validarCpf,
  validarCnpj,
  calcularDvCpf,
  calcularDvCnpj,
};
