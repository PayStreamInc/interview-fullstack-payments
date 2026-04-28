FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY apps/bank/package.json apps/bank/package.json

RUN npm install

COPY apps/bank apps/bank

WORKDIR /app/apps/bank

CMD ["npm", "run", "dev"]
