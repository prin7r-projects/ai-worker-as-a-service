# [SHIFTLEDGER_APP_DOCKERFILE] Multi-stage TypeScript Express build.
# 1. deps - install production deps
# 2. builder - compile TypeScript to dist/
# 3. runner - minimal node:22-alpine with the compiled app + views + public

FROM node:22-alpine AS deps
WORKDIR /app
COPY apps/app/package.json apps/app/pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

FROM node:22-alpine AS builder
WORKDIR /app
COPY apps/app/package.json apps/app/tsconfig.json ./
COPY apps/app/src ./src
COPY --from=deps /app/node_modules ./node_modules
RUN corepack enable && pnpm install --frozen-lockfile && npx tsc

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3001
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY apps/app/views ./views
COPY apps/app/public ./public
EXPOSE 3001
CMD ["node", "dist/server.js"]
