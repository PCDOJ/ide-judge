FROM node:18-alpine

# Install tzdata, mysql-client, wget and set timezone to Asia/Ho_Chi_Minh
RUN apk add --no-cache tzdata mysql-client wget && \
    cp /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime && \
    echo "Asia/Ho_Chi_Minh" > /etc/timezone && \
    apk del tzdata

ENV TZ=Asia/Ho_Chi_Minh

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy all application files
COPY . .

# Make entrypoint and scripts executable
RUN chmod +x /app/docker-entrypoint.sh && \
    chmod +x /app/scripts/*.sh 2>/dev/null || true

EXPOSE 2308

# Use custom entrypoint with sh
ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]

