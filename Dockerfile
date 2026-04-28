FROM node:20

WORKDIR /app

# Copy everything
COPY . .

# Install dependencies (all of them, including devDeps for build)
RUN npm install

# Build frontend
RUN npm run build

# Ensure server.ts is ready (we'll run it with tsx)
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Run using the local tsx binary
CMD ["./node_modules/.bin/tsx", "server.ts"]
