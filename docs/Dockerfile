FROM httpd:2.4-alpine
MAINTAINER Candid Dauth <cdauth@cdauth.eu>

RUN apk add --no-cache nodejs yarn

RUN echo "ErrorDocument 404 /404.html" >> /usr/local/apache2/conf/httpd.conf

COPY ./ /tmp/facilmap-docs

RUN cd /tmp/facilmap-docs && yarn install && yarn build && mv dist/* /usr/local/apache2/htdocs/ && rm -rf /tmp/facilmap-docs
