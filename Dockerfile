# ---- Stage 1: Build the Vite frontend ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source files
COPY . .

# Build the Vite frontend
RUN npm run build

# ---- Stage 2: Production runtime ----
FROM node:20-alpine AS runner

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies + tsx (needed to run server.ts)
RUN npm ci --omit=dev && npm install tsx typescript

# Copy built frontend assets from builder
COPY --from=builder /app/dist ./dist

# Copy server and config files
COPY server.ts ./
COPY tsconfig.json ./
COPY firebase-applet-config.json ./

# Cloud Run sets PORT env var; default to 3000
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

# Run the server using tsx
CMD ["npx", "tsx", "server.ts"]
