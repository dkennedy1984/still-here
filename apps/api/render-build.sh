#!/bin/bash
set -e
NODE_ENV=development pnpm install
cd ../../packages/shared && npx tsc --build
cd ../../apps/api && npx prisma generate --schema=prisma/schema.prisma && npx prisma db push --schema=prisma/schema.prisma --accept-data-loss && pnpm build
