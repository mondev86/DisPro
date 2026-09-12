# ============================================================
# Dockerfile (backend) — imagen de producción
#
#   Espejo de Node 20 con solo lo necesario.
#   Flow:  copiar package.json → npm ci (usa lockfile) →
#          prisma generate (crea el cliente JS) → copiar código →
#          arrancar con migraciones + servidor.
# ============================================================

# --- Base: Node 20 slim (Linux, ligera) ---
FROM node:20-slim

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# --- 1. Copiar manifiestos de dependencias ---
# (los copiamos ANTES del código para aprovechar la caché de capas de Docker:
#  si package.json no cambia, Docker no re-instala en la siguiente build)
COPY package.json package-lock.json* ./

# --- 2. Instalar dependencias de PRODUCCIÓN ---
# npm ci requiere lockfile; si no existe, caemos a npm install
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# --- 3. Generar el cliente Prisma (imprescindible para @prisma/client) ---
# En producción usamos el paquete prisma CLI temporalmente para `generate`
RUN npx prisma generate

# --- 4. Copiar el código fuente y el esquema Prisma ---
COPY prisma ./prisma
COPY src ./src

# El usuario seguro de Node: evita ejecutar el proceso como root
USER node

# Puerto que expone el contenedor (igual que PORT del .env)
EXPOSE 4000

# --- 5. Comando de arranque ---
# - prisma migrate deploy: aplica migraciones ya creadas (nunca genera nuevas)
# - node src/server.js: arranca API + Socket.io
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]