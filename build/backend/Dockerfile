FROM node:22-alpine

WORKDIR /opt/mango-test
COPY . ./
RUN ls -la
RUN npm install
RUN npx tsc

ENTRYPOINT ["/usr/local/bin/npm", "start"]
