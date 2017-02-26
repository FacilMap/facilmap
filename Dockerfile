FROM node:7.3-alpine
MAINTAINER Candid Dauth <cdauth@cdauth.eu>

CMD yarn run server
EXPOSE 8080

RUN apk update && apk add git
RUN npm install -g yarn@0.18.1

RUN adduser -D -h /opt/facilmap -s /bin/bash facilmap

WORKDIR /opt/facilmap/server

COPY ./ ../

RUN chown -R facilmap:facilmap /opt/facilmap

USER facilmap

RUN cd ../client && yarn run deps && yarn build && yarn link && \
    cd ../frontend && yarn run deps && yarn link facilmap-client && yarn run build && yarn link && \
    cd ../server && yarn run deps && yarn link facilmap-client facilmap-frontend && yarn add mysql pg sqlite3 tedious

USER root
RUN chown -R root:root /opt/facilmap

USER facilmap
