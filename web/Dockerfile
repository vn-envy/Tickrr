# Tickrr terminal (Vite + React) + Express server — Cloud Run container (multi-stage).

# --- build: compile the Vite client + bundle the server ---
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build   # -> dist/ (client) + dist/server.cjs (server bundle)

# --- run: production deps only, serve the built app ---
FROM node:20-slim AS run
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
# Headless Chromium for the media pipeline (real screenshots/recordings of the live app).
# Adds image size; only exercised when GROWTH_MEDIA is enabled.
RUN npx playwright install --with-deps chromium
COPY --from=build /app/dist ./dist
# Cloud Run injects $PORT (default 8080); server.ts reads it.
CMD ["node", "dist/server.cjs"]
