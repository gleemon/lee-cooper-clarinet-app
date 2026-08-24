# Stage 1: Build frontend
#
# The commit hash baked into the footer (see frontend/vite.config.js) is
# best-effort: it needs `git` and a `.git` dir in the build context, which
# Portainer's git-based stack deploys check out WITHOUT `.git`. Don't
# install git or copy .git here -- vite.config.js's own try/catch already
# falls back to "unknown" when git isn't available, so this stage builds
# fine either way. (A plain local `npm run build` outside Docker still
# picks up the real hash, since it isn't affected by any of this.)
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend + serve
FROM node:18-alpine
WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./backend/public

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "backend/server.js"]