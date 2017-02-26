FROM node:7.3-alpine
MAINTAINER Candid Dauth <cdauth@cdauth.eu>

CMD yarn run server
EXPOSE 8080

RUN apk update && apk add git
RUN npm install -g yarn@0.18.1

RUN adduser -D -h /opt/facilmap -s /bin/bash facilmap

WORKDIR /opt/facilmap/server

COPY ./ ../

RUN mkdir -p node_modules ../client/node_modules ../frontend/node_modules ../client/build ../frontend/build ../.cache ../.config ../.yarn && \
	touch yarn-error.log ../client/yarn-error.log ../frontend/yarn-error.log && \
	chown facilmap:facilmap node_modules ../client/node_modules ../frontend/node_modules ../client/build ../frontend/build ../.cache ../.config ../.yarn yarn-error.log ../client/yarn-error.log ../frontend/yarn-error.log yarn.lock ../frontend/yarn.lock ../client/yarn.lock package.json ../frontend/package.json ../client/package.json

USER facilmap

RUN cd ../client && yarn run deps && yarn build && yarn link && \
    cd ../frontend && yarn run deps && yarn link facilmap-client && yarn run build && yarn link && \
    cd ../server && yarn run deps && yarn link facilmap-client facilmap-frontend && yarn add mysql pg sqlite3 tedious

USER root
RUN chown -R root:root node_modules ../client/node_modules ../frontend/node_modules ../client/build ../frontend/build ../.cache ../.config ../.yarn yarn-error.log ../client/yarn-error.log ../frontend/yarn-error.log yarn.lock ../frontend/yarn.lock ../client/yarn.lock package.json ../frontend/package.json ../client/package.json

USER facilmap
