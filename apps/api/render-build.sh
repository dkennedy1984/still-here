#!/bin/bash
set -e
NODE_ENV=development pnpm install
cd ../../packages/shared && npx tsc --build
cd ../../apps/api && npx prisma generate --schema=prisma/schema.prisma && npx prisma migrate deploy --schema=prisma/schema.prisma && pnpm build
