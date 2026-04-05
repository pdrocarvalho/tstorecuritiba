# =============================================================================
# STAGE 1: deps — instala dependências de produção e dev
# =============================================================================
FROM node:22-alpine AS deps

WORKDIR /app

# Instala pnpm globalmente
RUN npm install -g pnpm

# Copia apenas os arquivos de lock para aproveitar o cache do Docker
COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

# =============================================================================
# STAGE 2: builder — compila o projeto
# =============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm run build

# =============================================================================
# STAGE 3: runner — imagem final enxuta (sem devDependencies)
# =============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g pnpm

# Copia apenas o necessário para rodar em produção
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

EXPOSE 3000

CMD ["node", "dist/index.js"]
