FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm install

COPY apps/api apps/api
COPY packages/shared packages/shared

WORKDIR /app/apps/api

CMD ["npm", "run", "dev"]
