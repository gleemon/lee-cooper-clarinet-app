# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder
RUN apk add --no-cache git
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
COPY .git /app/.git
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