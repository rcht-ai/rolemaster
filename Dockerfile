# Multi-stage build: install deps, build the SPA, then ship a slim runtime image
# that runs the API and serves the built SPA from the same port.

# ---- Stage 1: build the SPA ----
FROM node:22-alpine AS web-builder
WORKDIR /build
COPY app/package*.json ./app/
RUN cd app && npm ci
COPY app ./app
RUN cd app && npm run build

# ---- Stage 2: install server prod deps ----
FROM node:22-alpine AS server-deps
WORKDIR /build
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# ---- Stage 3: runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/data
ENV UPLOAD_DIR=/uploads

COPY server/package*.json ./server/
COPY --from=server-deps /build/server/node_modules ./server/node_modules
COPY server/src ./server/src

# SPA build artefacts go where the server looks for them.
COPY --from=web-builder /build/app/dist ./app/dist

# Mount a volume at /data and /uploads in production for SQLite + file uploads.
VOLUME ["/data", "/uploads"]

EXPOSE 3001

# Seed once on first boot (only if the DB doesn't exist yet), then start the server.
CMD ["sh", "-c", "test -f $DATA_DIR/rolemaster.db || node --experimental-sqlite server/src/seed.js; node --experimental-sqlite server/src/index.js"]
