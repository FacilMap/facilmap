FROM node:7.3-alpine
MAINTAINER Candid Dauth <cdauth@cdauth.eu>

CMD npm run server
EXPOSE 8080

RUN apk update && apk add git

RUN adduser -D -h /opt/facilmap -s /bin/bash facilmap
WORKDIR /opt/facilmap

COPY ./ ./
RUN chown -R facilmap:facilmap .

USER facilmap
RUN npm install -g yarn@0.18.1
RUN npm run deps && npm run clean && npm run build && node_modules/.bin/yarn add mysql pg sqlite3 tedious

USER root
RUN chown -R root:root .

USER facilmap
