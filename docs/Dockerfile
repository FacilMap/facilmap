FROM httpd:2.4-alpine
MAINTAINER Candid Dauth <cdauth@cdauth.eu>

RUN apk add --no-cache nodejs yarn

COPY ./ /tmp/facilmap-docs

RUN cd /tmp/facilmap-docs && yarn install && yarn build && mv dist/* /usr/local/apache2/htdocs/ && rm -rf /tmp/facilmap-docs
