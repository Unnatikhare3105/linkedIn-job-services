FROM node:20-alpine

WORKDIR /app

# Install curl (as in your original)
RUN apk add --no-cache curl

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source files
COPY services/job-service/src ./src/
COPY services/job-service/*.js ./

# Set permissions and switch to non-root user
RUN chown -R node:node /app
USER node

# Expose port (matching your original)
EXPOSE 3002

# Use the same CMD
CMD ["npm", "start"]