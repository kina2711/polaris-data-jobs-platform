FROM node:20-bookworm-slim AS base

# Prisma detects the OpenSSL ABI at generate time and also needs the matching
# runtime library in the production image.
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies only when needed
FROM base AS deps
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --ignore-scripts
RUN rm -rf node_modules/sharp node_modules/@xenova/transformers/node_modules/sharp
RUN mkdir -p node_modules/sharp node_modules/@xenova/transformers/node_modules/sharp && \
    echo '{"name":"sharp","version":"0.32.6","main":"index.js","type":"commonjs"}' > node_modules/sharp/package.json && \
    echo 'module.exports = {};' > node_modules/sharp/index.js && \
    echo '{"name":"sharp","version":"0.32.6","main":"index.js","type":"commonjs"}' > node_modules/@xenova/transformers/node_modules/sharp/package.json && \
    echo 'module.exports = {};' > node_modules/@xenova/transformers/node_modules/sharp/index.js
RUN npx prisma generate

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Keep the standard Next.js output because this repository also targets managed
# Next.js deployments where standalone output is not the canonical artifact.
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/package-lock.json ./package-lock.json

# Prisma engine + schema for @prisma/client runtime lookups
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

USER nextjs

EXPOSE 3400

ENV PORT=3400
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "run", "start"]
