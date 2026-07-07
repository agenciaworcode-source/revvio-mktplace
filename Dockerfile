# ============================================================
# REVVIO — build estático (Vite) servido por nginx
#
# As VITE_* são embutidas no bundle NO BUILD. No Coolify, defina
# VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY como Build Variables
# (elas chegam aqui como build args). A anon key é pública por
# design; NUNCA passe a service role key para este build.
# ============================================================

# ── etapa 1: build ──────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# ── etapa 2: serve ──────────────────────────────────────────
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
# 127.0.0.1 explícito: "localhost" pode resolver para ::1 primeiro (IPv6),
# e um nginx.conf customizado escapa da auto-config de IPv6 do entrypoint
# do nginx:alpine — isso causava "Connection refused" no healthcheck.
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
