# [SHIFTLEDGER_APP_DOCKERFILE] Single-stage tsx runner for Express app.
# The app uses tsx (TypeScript execute) directly — no tsc build needed.
# Dependencies are installed via pnpm in the workspace context.

FROM node:22-alpine AS runner
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy workspace root files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy app source and config
COPY apps/app/package.json apps/app/tsconfig.json apps/app/drizzle.config.json apps/app/
COPY apps/app/src apps/app/src
COPY apps/app/views apps/app/views
COPY apps/app/public apps/app/public
COPY apps/app/migrations apps/app/migrations
COPY data data

# Install dependencies
RUN pnpm install --frozen-lockfile --filter shiftledger-app --ignore-scripts

ENV NODE_ENV=production PORT=3001
WORKDIR /app/apps/app
EXPOSE 3001
CMD ["npx", "tsx", "src/server.ts"]
