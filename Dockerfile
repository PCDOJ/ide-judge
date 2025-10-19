FROM node:18-alpine

# Install tzdata, mysql-client and set timezone to Asia/Ho_Chi_Minh
RUN apk add --no-cache tzdata mysql-client && \
    cp /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime && \
    echo "Asia/Ho_Chi_Minh" > /etc/timezone && \
    apk del tzdata

ENV TZ=Asia/Ho_Chi_Minh

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Make migration script executable
RUN chmod +x /app/scripts/run-migrations.sh

EXPOSE 2308

CMD ["sh", "/app/scripts/run-migrations.sh"]

