FROM node:20-slim

WORKDIR /app

COPY solver-api/package.json ./

RUN npm install

COPY solver-api/src/ ./src/

EXPOSE 4000

CMD ["npx", "tsx", "src/server.ts"]
