FROM node:latest
MAINTAINER Candid Dauth <cdauth@cdauth.eu>

CMD npm run server
EXPOSE 8080

RUN useradd -m -d /opt/facilpad -s /bin/bash facilpad
WORKDIR /opt/facilpad

COPY ./ ./
RUN chown -R facilpad:facilpad .

USER facilpad
RUN npm run deps && npm run clean && npm run build

USER root
RUN chown -R root:root .

USER facilpad