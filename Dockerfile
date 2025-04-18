FROM node:20-bullseye-slim

WORKDIR /app

# Install required packages
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and install dependencies
COPY ./app/package.json ./
RUN npm install

# Start the application
CMD ["node", "index.js"]