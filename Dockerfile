# Use a lightweight Node.js base image
FROM node:20-alpine

# Set environment to production
ENV NODE_ENV=production

# Set working directory
WORKDIR /usr/src/app

# Copy package configurations
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy application files and folders with ownership set to the non-root node user
COPY --chown=node:node css/ ./css/
COPY --chown=node:node js/ ./js/
COPY --chown=node:node lang/ ./lang/
COPY --chown=node:node workers/ ./workers/
COPY --chown=node:node index.html ./
COPY --chown=node:node server.js ./
COPY --chown=node:node sw.js ./

# Expose port 8080 (the default Cloud Run port)
ENV PORT=8080
EXPOSE 8080

# Switch to non-root user
USER node

# Command to run the application
CMD ["node", "server.js"]
