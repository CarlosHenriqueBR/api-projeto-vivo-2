# Deploy no Render

API sem dependencias externas (Node puro). O deploy usa o runtime Node do Render.

## 1. Subir o codigo para o GitHub

```bash
git init
git add .
git commit -m "API projeto vivo"
git branch -M main
git remote add origin https://github.com/<usuario>/<repo>.git
git push -u origin main
```

> `data/massas.json` **precisa** ir para o repositorio: a API falha ao subir sem esse arquivo.

## 2. Criar o servico

**Opcao A - Blueprint (recomendado).** No Render: *New > Blueprint*, aponte para o repositorio.
O arquivo [render.yaml](render.yaml) ja define build, start, health check e variaveis.

**Opcao B - Manual.** *New > Web Service*, e preencha:

| Campo | Valor |
| --- | --- |
| Runtime | Node |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Health Check Path | `/health` |

## 3. Variaveis de ambiente

| Variavel | Valor em producao | Observacao |
| --- | --- | --- |
| `PORT` | *(nao definir)* | Injetada pelo Render |
| `HOST` | `0.0.0.0` | Obrigatorio; o Render nao enxerga `127.0.0.1` |
| `API_SECRET` | valor aleatorio | Assina o JWT. O blueprint gera automaticamente |
| `TOKEN_TTL` | `3600` | Validade do token em segundos |
| `EXIGIR_SENHA` | `false` | `true` torna a senha obrigatoria no `/auth/token` |
| `EXPOR_MASSAS` | `true` | **`GET /api/v1/massas` publica documentos e senhas de teste.** Use `false` se a URL for publica |
| `NODE_ENV` | `production` | |

## 4. Validar apos o deploy

```bash
BASE=https://<seu-servico>.onrender.com

curl $BASE/health

TOKEN=$(curl -s -X POST $BASE/api/v1/auth/token \
  -H 'content-type: application/json' \
  -d '{"documento":"43252027062"}' | sed -n 's/.*"access_token": "\([^"]*\)".*/\1/p')

curl $BASE/api/v1/consulta -H "Authorization: Bearer $TOKEN"
```

No Postman, troque a variavel `baseUrl` do environment para a URL do Render.

## Notas

- **Plano free:** o servico hiberna apos ~15 min sem trafego; a primeira chamada depois disso demora alguns segundos.
- **Dados em memoria:** as massas sao lidas de `data/massas.json` no boot. Para alterar a base, rode `npm run gerar-massas`, commite o arquivo e faca push.
- **Docker:** existe um [Dockerfile](Dockerfile) caso prefira; nesse caso troque `runtime: node` por `runtime: docker` no `render.yaml`.
