FROM node:20-slim
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm ci --production && npm cache clean --force
ENV NODE_ENV="production"
EXPOSE 3000
CMD [ "npm", "start" ]
