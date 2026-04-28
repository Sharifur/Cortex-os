FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY drizzle ./drizzle
COPY healthcheck.js ./healthcheck.js

ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=120s --retries=15 \
  CMD node /app/healthcheck.js

CMD ["node", "dist/src/main"]
