FROM node:11.5-alpine
MAINTAINER Candid Dauth <cdauth@cdauth.eu>

CMD npm run server
EXPOSE 8080

RUN apk add --no-cache g++ git make python2

RUN adduser -D -h /opt/facilmap -s /bin/bash facilmap

WORKDIR /opt/facilmap/server

COPY ./ ../

RUN chown -R facilmap:facilmap /opt/facilmap

USER facilmap

RUN mkdir ~/.local && npm config set prefix ~/.local && \
    cd ../client && npm run deps && npm run build && npm link && \
    cd ../frontend && npm run deps && npm link facilmap-client && npm run build && npm link && \
    cd ../server && npm run deps && npm install mysql pg sqlite3 tedious && npm link facilmap-client facilmap-frontend

USER root
RUN chown -R root:root /opt/facilmap && chown -R facilmap:facilmap /opt/facilmap/server/cache

USER facilmap
