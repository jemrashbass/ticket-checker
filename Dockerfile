FROM node:16-slim

WORKDIR /app

# Install required packages
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json
COPY ./app/package*.json ./

# Install dependencies
RUN npm install

# Start the application
CMD ["node", "test.js"]