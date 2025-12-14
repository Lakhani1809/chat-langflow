# Dockerfile for MyMirro Chat API
# Simplified for Railway deployment

FROM node:18-alpine

# Install dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source code
COPY . .

# Build Next.js
RUN npm run build

# Set environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Expose port (Railway will override with PORT env var)
EXPOSE 3000

# Start the app using npm start (more reliable than standalone)
CMD ["npm", "start"]

