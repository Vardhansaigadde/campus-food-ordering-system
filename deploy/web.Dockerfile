# Builds the React app and serves it with Caddy, which also:
#  - gets a free HTTPS certificate from Let's Encrypt automatically
#  - forwards /api/* to the API Gateway (the gateway itself is never exposed)
# Build context is the project root (see docker-compose.yml).

FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
