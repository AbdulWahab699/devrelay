FROM node:20-alpine AS base

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

RUN npm install -g pnpm@11.8.0
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend

# Build
RUN pnpm --filter @devrelay/shared build
RUN pnpm --filter @devrelay/backend build

WORKDIR /app/packages/backend

EXPOSE 3001

CMD ["node", "dist/index.js"]