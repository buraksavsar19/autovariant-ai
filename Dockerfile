FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY web/package*.json ./

# Install dependencies
RUN npm install

# Copy frontend package files
COPY web/frontend/package*.json ./frontend/
RUN cd frontend && npm install

# Copy application code
COPY web/ .

# Copy Privacy Policy and Terms of Service (needed for /privacy and /terms routes)
COPY PRIVACY.md TERMS.md ./

# Build frontend (SHOPIFY_API_KEY will be provided at runtime via env var)
# Note: Frontend build might need API key, but we'll handle it at runtime
RUN cd frontend && SHOPIFY_API_KEY=dummy npm run build || echo "Build may need runtime API key"

# Expose port (Railway will set PORT env var)
EXPOSE 3000

# Start the application
CMD ["npm", "run", "serve"]
