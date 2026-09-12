# ============================================================
# Dockerfile (frontend) — compila el bundle y lo sirve con nginx
#
# Dos fases (multi-stage build):
#   1. build → instala deps, compila React/Vite → dist/
#   2. runtime → nginx sirve los estáticos y proxifica la API
# ============================================================

# ---------- FASE 1: compilar ----------
FROM node:20-slim AS build

WORKDIR /app

# 1. Manifiestos primero (caché de capas)
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# 2. Código fuente + build
COPY . .
RUN npm run build

# ---------- FASE 2: servir con nginx ----------
FROM nginx:1.27-alpine

# Copiamos los estáticos compilados
COPY --from=build /app/dist /usr/share/nginx/html

# Configuración: redirige /api y /socket.io hacia el backend
# (ver frontend/nginx.conf). El output debe copiarse en:
#   /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Puerto 80 (nginx) → mapeado a 5173 en docker-compose
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]