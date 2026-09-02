# Guia de uso — API Projeto Vivo - com massas geradas a partir de uma real

# API TESTADA FUNCIONAL, SEGUIR O GUIA PARA EXECUTAR DE FORMA SIMPLES


Este guia mostra, do começo ao fim, como subir a API na sua máquina, importar a collection no Postman e disparar as requisições. Não presume conhecimento prévio do projeto: se você seguir os passos na ordem, em uns cinco minutos está com o retorno de dívidas na tela.

> Para publicar esta API na internet (Render), veja [DEPLOY-RENDER.md](DEPLOY-RENDER.md).

A API é um **mock local**. Ela não consulta nada externo — devolve massas fictícias guardadas num arquivo JSON, no mesmo formato do backend original (`statusCode` / `body` / `headers`). A autenticação, porém, é de verdade: valida dígito verificador de CPF, CNPJ e CNPJ alfanumérico, e emite um JWT assinado.

---

## Antes de começar

Você precisa de duas coisas:

**Node.js 18 ou superior.** Confira no terminal:

```bash
node -v
```

Se aparecer algo como `v26.7.0`, está ok. Se der "command not found", instale o Node em https://nodejs.org.

**Postman Desktop.** Baixe em https://www.postman.com/downloads/. Precisa ser o aplicativo instalado, não a versão do navegador — explico o motivo no final, na seção de problemas.

Não há nada para instalar no projeto. A API não usa nenhuma biblioteca externa, então **não existe `npm install` aqui**. É só Node puro.

---

## Passo 1 — Abrir a pasta no terminal

```bash
cd "/Users/carloshenrique/Documents/api projeto vivo"
```

As aspas são necessárias por causa dos espaços no nome da pasta.

Confira que você está no lugar certo:

```bash
ls
```

Você deve ver `package.json`, `src`, `data`, `postman`, entre outros.

---

## Passo 2 — Subir a API

```bash
npm start
```

A saída esperada é esta:

```
> api-projeto-vivo@1.0.0 start
> node src/server.js

API local no ar em http://127.0.0.1:3333
Massas: 15 registros (referencia 2026-08-24)
Senha obrigatoria: nao (opcional)
```

Pronto, a API está no ar na porta **3333**.

Duas observações importantes:

- **Deixe esse terminal aberto.** Enquanto ele estiver rodando, a API responde. Se você fechar a janela ou apertar `Ctrl+C`, a API cai. Para os próximos comandos, abra uma segunda aba do terminal.
- **A porta é 3333, não 3000.** Escolhi a 3333 de propósito, porque a 3000 costuma estar ocupada pelo Next.js do Finvix nesta máquina. Se as duas brigarem pela mesma porta, o Postman acaba conversando com a aplicação errada.

Se a porta 3333 também estiver ocupada, a API avisa e não sobe calada. Nesse caso use outra:

```bash
PORT=4000 npm start
```

E lembre de trocar a `baseUrl` no Postman para `http://127.0.0.1:4000` (mostro onde no Passo 5).

---

## Passo 3 — Conferir se subiu mesmo

Antes de ir para o Postman, vale uma checagem rápida. Numa **segunda aba** do terminal:

```bash
curl http://127.0.0.1:3333/health
```

A resposta deve ser um JSON começando assim:

```json
{
  "status": "ok",
  "servico": "api-projeto-vivo (mock local)",
  "exigeSenha": false,
  "massas": {
    "totalRegistros": 15
  }
}
```

Se preferir, abra `http://127.0.0.1:3333/health` no navegador — dá no mesmo.

Se voltar uma página HTML em vez desse JSON, pule direto para a seção **Problemas comuns**, no final: é outra aplicação ocupando a porta.

---

## Passo 4 — Importar a collection no Postman

1. Abra o Postman Desktop.
2. No canto superior esquerdo, clique no botão **Import**.
3. Clique em **Choose files** (ou arraste os arquivos para a janela).
4. Navegue até a pasta `postman/` do projeto e selecione **os dois arquivos de uma vez**:
   - `api-projeto-vivo.postman_collection.json` — as requisições
   - `local.postman_environment.json` — as variáveis (URL, documentos e senhas)
5. Confirme em **Import**.

O caminho completo da pasta, se precisar colar no seletor de arquivos:

```
/Users/carloshenrique/Documents/api projeto vivo/postman
```

Depois de importar, na barra lateral esquerda (aba **Collections**) aparece **API Projeto Vivo (mock local)** com quatro pastas dentro:

```
API Projeto Vivo (mock local)
├── 1. Autenticacao          4 requisições
├── 2. Consulta              2 requisições
├── 3. Apoio                 2 requisições
└── 4. Cenarios de erro      4 requisições
```

---

## Passo 5 — Selecionar o environment

Esse passo é fácil de esquecer e é o motivo número um de erro logo na primeira requisição.

No **canto superior direito** do Postman existe uma caixa de seleção que normalmente vem escrita "No Environment". Clique nela e escolha **Projeto Vivo - Local**.

É esse environment que preenche a variável `{{baseUrl}}` com `http://127.0.0.1:3333`. Sem ele selecionado, o Postman não sabe para onde mandar a requisição e devolve um erro de URL inválida.

Se você subiu a API em outra porta (Passo 2), é aqui que se ajusta: clique no ícone de olho ao lado da caixa, depois em **Edit**, e troque o valor de `baseUrl`.

---

## Passo 6 — Pegar o token

Abra a pasta **1. Autenticacao** e clique em **Token com CNPJ alfanumerico**. Você vai ver, na aba **Body**, algo assim:

```json
{
  "documento": "V6.6VW.DP0/40QP-63"
}
```

Clique no botão azul **Send**.

A resposta, com status **200 OK**, traz:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "escopo": "consulta:dividas",
  "documento": "V66VWDP040QP63",
  "documentoFormatado": "V6.6VW.DP0/40QP-63",
  "tipoDocumento": "CNPJ_ALFANUMERICO",
  "nome": "Quaresma Tecnologia e Inovacao LTDA"
}
```

**Você não precisa copiar esse token.** A requisição tem um script na aba **Tests** que grava o `access_token` na variável `{{token}}` da collection automaticamente. As requisições de consulta já usam essa variável no header `Authorization`.

Para se certificar de que deu certo, olhe a aba **Test Results** no painel de resposta: devem aparecer dois testes verdes, "status 200" e "token retornado".

O token vale **1 hora** (`expires_in: 3600`). Passou disso, é só rodar essa requisição de novo.

Vale repetir o Send nas outras duas requisições da mesma pasta — **Token com CPF** e **Token com CNPJ numerico** — para ver que os três tipos de documento funcionam igual. Cada uma sobrescreve o `{{token}}`, então o token ativo é sempre o da última que você rodou.

---

## Passo 7 — Consultar as dívidas

Abra a pasta **2. Consulta**, clique em **Consultar dividas (token atual)** e mande **Send**.

O retorno vem no formato do backend original:

```json
{
  "statusCode": 200,
  "body": {
    "ValorTotalContratos": 14099.22,
    "QtdFaturasAbertoContratos": 5,
    "QtdContratos": 2,
    "GlobalOnes": [],
    "Cybers": [
      {
        "ContratoOriginal": "1629690748-CRT",
        "Billing": "CRT",
        "QtdDiasAtraso": 59,
        "QtdFaturasAberto": 1,
        "ValorTotalFaturas": 3715.98,
        "Produto": null,
        "TelDivida": null,
        "Faturas": [ ... ],
        "Negociacao": [ ... ]
      }
    ],
    "Rpa": []
  },
  "headers": { ... }
}
```

O que você está vendo:

| Campo | O que significa |
| --- | --- |
| `ValorTotalContratos` | Soma da dívida de todos os contratos |
| `QtdContratos` | Quantos contratos aquele documento tem em aberto |
| `Cybers` | A lista dos contratos, um objeto por contrato |
| `Faturas` | As faturas vencidas do contrato, com linha digitável de 48 dígitos |
| `Negociacao` | As opções de acordo: a primeira é sempre à vista com desconto, as demais são parceladas com entrada |
| `GlobalOnes` e `Rpa` | Sempre listas vazias — o formato desses dois blocos não foi informado |

Os números batem entre si: a soma das `ValorParcela` dá o `ValorTotalFaturas` do contrato, e a soma dos contratos dá o `ValorTotalContratos`. Se você estiver validando um cálculo do lado de cá, pode confiar na massa.

A segunda requisição da pasta, **Consultar dividas por documento**, faz a mesma coisa mas com o documento na URL. Ela serve para testar a checagem de dono: se o token for de um documento e a URL apontar para outro, a API responde **403**.

---

## Passo 8 — Testar os cenários de erro

A pasta **4. Cenarios de erro** existe para você ver como a API reage quando algo vem errado. Rode as quatro e confira o status:

| Requisição | Status esperado | Motivo |
| --- | --- | --- |
| Documento com DV invalido | **400** | `12.ABC.345/01DE-99` — o dígito verificador não fecha |
| Documento valido sem cadastro | **401** | `12.ABC.345/01DE-35` é válido, mas não está na base de massas |
| Senha errada | **401** | O documento existe, a senha não confere |
| Consulta sem token | **401** | Faltou o header `Authorization` |

Cada uma tem um teste na aba **Test Results** confirmando o status. Repare que documento inválido dá **400** (erro de formato) e documento válido sem cadastro dá **401** (erro de autorização) — são situações diferentes de propósito.

---

## Passo 9 — Rodar a collection inteira de uma vez

Quando quiser validar tudo de uma tacada só, sem clicar requisição por requisição:

**Pelo Postman:** passe o mouse sobre o nome da collection na barra lateral, clique nos três pontinhos (`...`) e escolha **Run collection**. Na tela do Runner, clique em **Run API Projeto Vivo**. Ele dispara as 12 requisições em sequência e mostra o placar dos testes no final.

**Pelo terminal**, se preferir não abrir o Postman:

```bash
npm run teste-postman
```

Esse comando lê os mesmos arquivos da pasta `postman/` e executa a collection contra a API que estiver no ar, rodando inclusive os scripts da aba Tests. A saída é assim:

```
# 1. Autenticacao
  200  POST Token com CPF  (31ms, 557 bytes)
      teste: status 200 — passou
      teste: token retornado — passou
...
12 requisicoes, 10 asserts, 0 falha(s).
```

Existe ainda o `npm run teste`, que é independente do Postman: ele sobe a API numa porta livre, roda 12 verificações de ponta a ponta e derruba tudo no final. Bom para rodar rápido sem se preocupar com porta ocupada.

---

## Os 15 documentos disponíveis

Estes são os documentos cadastrados. Todos são **fictícios**, mas com dígito verificador válido — passam em qualquer validador de CPF/CNPJ.

A senha é opcional: se você mandar o campo `senha`, ela precisa estar certa; se omitir, o token sai do mesmo jeito. Ela só vira obrigatória se você subir a API com `EXIGIR_SENHA=true`.

| Tipo | Documento | Senha | Nome | Contratos | Faturas | Total |
| --- | --- | --- | --- | --- | --- | --- |
| CPF | `432.520.270-62` | `Vivo@7062` | Aurelio Prado Bittencourt | 3 | 8 | R$ 1586,02 |
| CPF | `088.054.495-39` | `Vivo@9539` | Marisa Colaco Ferreira | 2 | 5 | R$ 850,73 |
| CPF | `179.623.966-60` | `Vivo@6660` | Tulio Vasques Andrade | 2 | 3 | R$ 421,72 |
| CPF | `424.861.335-26` | `Vivo@3526` | Neide Camargo Portela | 2 | 5 | R$ 617,98 |
| CPF | `765.583.838-02` | `Vivo@3802` | Ivan Bragancao Mesquita | 3 | 7 | R$ 1604,41 |
| CNPJ | `91.863.013/0002-20` | `Vivo@0220` | Corveta Distribuidora de Alimentos LTDA | 2 | 5 | R$ 11594,12 |
| CNPJ | `77.927.708/0003-89` | `Vivo@0389` | Pantanal Solucoes em Logistica ME | 2 | 6 | R$ 11165,30 |
| CNPJ | `42.895.679/0001-74` | `Vivo@0174` | Vertigo Comercio de Autopecas LTDA | 1 | 1 | R$ 2292,79 |
| CNPJ | `98.267.375/0003-89` | `Vivo@0389` | Serra Azul Servicos de Limpeza EIRELI | 2 | 4 | R$ 7636,97 |
| CNPJ | `79.280.687/0001-16` | `Vivo@0116` | Marejo Industria de Embalagens SA | 1 | 2 | R$ 6369,45 |
| CNPJ alfanumérico | `V6.6VW.DP0/40QP-63` | `Vivo@QP63` | Quaresma Tecnologia e Inovacao LTDA | 2 | 5 | R$ 14099,22 |
| CNPJ alfanumérico | `XA.OAV.X26/19AI-51` | `Vivo@AI51` | Arauto Servicos Financeiros SA | 2 | 5 | R$ 8181,95 |
| CNPJ alfanumérico | `9L.JJW.TP9/59MV-22` | `Vivo@MV22` | Bromelia Agroindustrial LTDA | 3 | 8 | R$ 17461,59 |
| CNPJ alfanumérico | `X5.RPO.DCT/97YO-90` | `Vivo@YO90` | Nimbus Data Center Servicos SA | 3 | 6 | R$ 16420,65 |
| CNPJ alfanumérico | `F9.6UP.6RD/33AD-68` | `Vivo@AD68` | Cerrado Mobilidade Urbana LTDA | 1 | 3 | R$ 8449,26 |

Se você não quiser consultar esta tabela toda vez, a própria API lista tudo em `GET /api/v1/massas` — é a requisição **Listar as 15 massas**, na pasta **3. Apoio**.

---

## Montando a requisição na mão

Se em algum momento você quiser criar a requisição do zero, sem a collection, é assim:

**Autenticar**

- Método: `POST`
- URL: `http://127.0.0.1:3333/api/v1/auth/token`
- Aba **Body** → marque **raw** → no seletor à direita, escolha **JSON**
- Conteúdo:
  ```json
  { "documento": "V6.6VW.DP0/40QP-63" }
  ```

O documento pode ir com ou sem máscara, tanto faz: `V6.6VW.DP0/40QP-63` e `V66VWDP040QP63` funcionam igual. Copie o `access_token` da resposta.

**Consultar**

- Método: `GET`
- URL: `http://127.0.0.1:3333/api/v1/consulta`
- Aba **Authorization** → em **Type**, escolha **Bearer Token** → cole o token no campo à direita

Não precisa de mais nada. Não há header customizado, api key ou body na consulta.

---

## Parar a API

No terminal onde ela está rodando, aperte `Ctrl+C`.

Se você fechou aquela janela e a API ficou rodando solta, derrube pelo nome do processo:

```bash
pkill -f "node src/server.js"
```

Para confirmar que a porta ficou livre:

```bash
lsof -nP -iTCP:3333 -sTCP:LISTEN
```

Sem resposta significa que não tem ninguém escutando ali.

---

## Problemas comuns

### A resposta veio em HTML, com uma tela de login

Foi o problema que mais apareceu por aqui. Se o Postman devolver uma página HTML — por exemplo o login do **Finvix**, com `redirectTo=/api/v1/consulta` na URL —, a requisição **não chegou nesta API**. Tem outra aplicação ocupando a porta, e ela respondeu no lugar.

Esta API responde **sempre** `application/json`, nunca HTML. HTML na resposta é sinal certo de destino errado.

Veja quem está na porta:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

Se aparecer um processo que não é o nosso, é justamente por isso que a `baseUrl` aponta para a **3333**. Confira no Postman se a variável está mesmo com `http://127.0.0.1:3333`.

### "Could not send request" ou "connect ECONNREFUSED"

A API não está rodando. Volte ao Passo 2 e rode `npm start`. Confirme que o terminal ficou aberto com a mensagem "API local no ar".

### Erro de URL inválida logo na primeira requisição

Quase sempre é o environment. Verifique o canto superior direito do Postman: precisa estar escrito **Projeto Vivo - Local**, e não "No Environment" (Passo 5).

### 401 com `token_expirado`

O token passou de uma hora. Rode qualquer requisição da pasta **1. Autenticacao** de novo — o `{{token}}` é atualizado sozinho e a consulta volta a funcionar.

### 401 com `documento_nao_autorizado`

O documento é válido, mas não está entre os 15 cadastrados. Use um da tabela acima, ou consulte `GET /api/v1/massas`.

### 403 com `documento_divergente`

Acontece na requisição **Consultar dividas por documento**: o token pertence a um documento e a URL pede outro. Autentique com o documento que você quer consultar e tente de novo.

### O Postman Web não conecta

A versão do Postman que roda no navegador não enxerga `127.0.0.1` da sua máquina sem o Postman Desktop Agent. Use o **Postman Desktop** e o problema desaparece.

---

## Trocar as massas

O arquivo `data/massas.json` é gerado por script. Se quiser massas novas:

```bash
npm run gerar-massas
```

Um aviso antes de rodar: **os 15 documentos mudam**, porque são sorteados novos (sempre com DV válido). Se você já colocou os documentos atuais em algum roteiro de teste, faça uma cópia do `data/massas.json` antes.

Dá para fixar a geração passando data de referência e semente — com os mesmos parâmetros, o resultado é idêntico:

```bash
node scripts/gerar-massas.js --base=2026-08-24 --seed=20260824
```

A data de referência é o "hoje" da massa: é a partir dela que se calculam os vencimentos em atraso e o campo `QtdDiasAtraso`.

---

## Resumo em cinco linhas

Para quem já leu isto uma vez e só quer o roteiro:

```bash
cd "/Users/carloshenrique/Documents/api projeto vivo"
npm start                                  # deixa rodando na 3333
```

No Postman: **Import** os dois arquivos de `postman/` → selecione o environment **Projeto Vivo - Local** → rode qualquer requisição de **1. Autenticacao** → rode **Consultar dividas** em **2. Consulta**.
