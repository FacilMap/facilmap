FROM node:7.3-alpine
MAINTAINER Candid Dauth <cdauth@cdauth.eu>

CMD yarn run server
EXPOSE 8080

RUN apk update && apk add git
RUN npm install -g yarn

RUN mkdir -p /opt/facilmap && adduser -D -h /opt/facilmap -s /bin/bash facilmap && chown facilmap:facilmap /opt/facilmap

USER facilmap
WORKDIR /opt/facilmap

COPY ./ ./

WORKDIR /opt/facilmap/server

RUN cd ../client && yarn run deps && yarn build && yarn link && \
    cd ../frontend && yarn run deps && yarn link facilmap-client && yarn run build && yarn link && \
    cd ../server && yarn run deps && yarn link facilmap-client facilmap-frontend && yarn add mysql pg sqlite3 tedious

USER root
RUN chown -R root:root /opt/facilmap

USER facilmap
