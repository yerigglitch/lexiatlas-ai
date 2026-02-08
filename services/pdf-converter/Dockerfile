FROM node:20-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends libreoffice fonts-dejavu \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

EXPOSE 8080

CMD ["npm", "start"]
