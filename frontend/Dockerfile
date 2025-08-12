FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

# Build the application
RUN npm run build

# Debug: показываем структуру после сборки
RUN echo "=== Contents of /app after build ===" && \
    ls -la /app/ && \
    echo "=== Contents of /app/.next ===" && \
    ls -la /app/.next/ || true && \
    echo "=== Contents of /app/.next/standalone ===" && \
    ls -la /app/.next/standalone/ || true && \
    echo "=== Looking for server.js ===" && \
    find /app -name "server.js" -type f 2>/dev/null || true

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Копируем public и package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Копируем standalone приложение
# Next.js создает все файлы в .next/standalone, включая server.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/. ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Debug в production
RUN echo "=== Final contents of /app ===" && \
    ls -la /app/ && \
    echo "=== Looking for server.js in final image ===" && \
    find /app -name "server.js" -type f 2>/dev/null || true

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Запускаем server.js из корня /app
CMD ["node", "server.js"]
