# 1. Base image targeting the linux/amd64 platform
FROM --platform=linux/amd64 node:18-alpine

WORKDIR /app

# 2. Copy package configuration files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# 3. Copy application source files
COPY . .

# 4. Inform Render of the communication port
EXPOSE 10000

# 5. Define runtime command
CMD ["node", "server.js"]
