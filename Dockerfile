FROM node:12.13.0-alpine as stage

RUN mkdir /github-actions
WORKDIR /github-actions

COPY package.json ./

RUN npm install

FROM stage

COPY . .

RUN npm run lint
RUN npm run cover