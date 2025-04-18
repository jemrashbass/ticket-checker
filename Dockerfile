# Dockerfile
FROM node:16-slim

WORKDIR /app

# Install required packages
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Start the application
CMD ["node", "index.js"]

