FROM node:8

WORKDIR /app
ADD . .

RUN npm install

CMD ["node", "index.js"]
