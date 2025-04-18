# Dockerfile
FROM node:16-slim

WORKDIR /app

# Install required packages
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY ./app/package*.json ./
RUN npm install

# Start the application
CMD ["node", "index.js"]