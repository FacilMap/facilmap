FROM node:22-alpine
MAINTAINER Candid Dauth <cdauth@cdauth.eu>

ENTRYPOINT ["/opt/facilmap/entrypoint.sh"]
CMD yarn run prod-server
EXPOSE 8080
ENV CACHE_DIR=/opt/facilmap/cache
VOLUME /opt/facilmap/cache
HEALTHCHECK --start-period=60s --start-interval=3s --timeout=5s --retries=1 \
	CMD wget -O/dev/null 'http://127.0.0.1:8080/socket.io/?EIO=4&transport=polling' || exit 1

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