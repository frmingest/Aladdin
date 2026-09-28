# syntax=docker/dockerfile:1.7
# Production image for the frontend: a Vite build served as static files
# (architecture §26 "Deployment & production hardening" phase — see
# docs/decisions/0010). Not used by local dev, which runs `npm run dev`
# directly — see README.
#
# Build context is frontend/ itself:
#   docker build -f frontend/Dockerfile \
#     --build-arg VITE_API_BASE_URL=https://aladdin-backend.up.railway.app \
#     -t aladdin-frontend frontend
# VITE_API_BASE_URL is baked in at build time (Vite env vars are
# compile-time, not runtime) — see src/services/api.ts. Leave it unset only
# if frontend and backend genuinely share an origin in production, which
# Railway's per-service model does not give you by default.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_BASE_URL
ARG VITE_API_KEY
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_API_KEY=${VITE_API_KEY}
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Written inline with RUN instead of `COPY nginx.conf ...` — Railway's
# builder (multi-stage Dockerfile + a custom Root Directory) has been seen
# to fail resolving a plain build-context file referenced only in a later
# stage ("failed to calculate checksum of ref ...: not found") even though
# the file is present in the repo. Baking the config in with RUN sidesteps
# that context-snapshot lookup entirely. Content matches the former
# frontend/nginx.conf (kept in the repo for local `docker build` reference).
#
# gzip + long-lived caching added 2026-09-28 (page-load-performance
# investigation, claude/page-load-performance-investigation-2026-09-28.md):
# this previously shipped the built JS/CSS bundle uncompressed and with no
# cache headers on every single visit.
COPY <<EOF /etc/nginx/templates/default.conf.template
server {
    listen \${PORT};
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/javascript application/json
        application/xml application/xml+rss image/svg+xml font/woff2;

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback — client-side routing owns every unknown path.
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

# Railway (and most PaaS targets) inject PORT; nginx's templating
# (docker-entrypoint.d, built into the nginx image) substitutes it into the
# listen directive at container start.
ENV PORT=8080
EXPOSE 8080
