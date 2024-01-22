FROM node:21-alpine
MAINTAINER Candid Dauth <cdauth@cdauth.eu>

CMD yarn run prod-server
EXPOSE 8080
ENV CACHE_DIR=/opt/facilmap/cache

RUN apk add --no-cache yarn

RUN mkdir /opt/facilmap && adduser -D -H -h /opt/facilmap -s /bin/sh facilmap

WORKDIR /opt/facilmap

COPY ./ ./

RUN yarn install && \
	yarn check-types && \
	yarn lint && \
	yarn test && \
	yarn run build:frontend:app && \
	yarn run build:server && \
	yarn workspaces focus -A --production

RUN mkdir -p "$CACHE_DIR" && chown -R facilmap:facilmap "$CACHE_DIR"

USER facilmap
