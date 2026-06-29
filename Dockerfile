FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY turbo.json ./
COPY tsconfig.base.json ./

COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend

RUN pnpm --filter @devrelay/shared build
RUN pnpm --filter @devrelay/backend build

WORKDIR /app/packages/backend

EXPOSE 3001

CMD ["node", "dist/index.js"]
