#!/bin/bash
set -e
cd /opt/render/project/src
NODE_ENV=development pnpm install
cd packages/shared && npx tsc --build && cd ../..
cd apps/api
npx prisma generate --schema=prisma/schema.prisma
npx prisma db push --schema=prisma/schema.prisma --accept-data-loss
pnpm build
