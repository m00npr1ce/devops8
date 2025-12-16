FROM node:20-alpine AS base

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./

RUN npm install --production

COPY src ./src
COPY test ./test

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]


