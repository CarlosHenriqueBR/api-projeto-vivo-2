# Alternativa ao runtime Node nativo do Render (runtime: docker no render.yaml).
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY data ./data

ENV HOST=0.0.0.0
EXPOSE 3333
CMD ["node", "src/server.js"]
