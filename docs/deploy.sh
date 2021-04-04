#!/usr/bin/env sh
set -e
yarn build
cd src/.vuepress/dist
echo 'docs.facilmap.org' > CNAME
git init
git add -A
git commit -m 'deploy'
git push -f git@github.com:facilmap/facilmap-docs.git master
cd -