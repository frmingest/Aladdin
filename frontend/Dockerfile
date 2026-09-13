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
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Railway (and most PaaS targets) inject PORT; nginx's templating
# (docker-entrypoint.d, built into the nginx image) substitutes it into the
# listen directive at container start.
ENV PORT=8080
EXPOSE 8080
