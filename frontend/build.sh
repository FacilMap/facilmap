#!/bin/bash

IFS="
"

cd "$(dirname "$0")"

[ ! -e build ] && mkdir build
rm -f build/*

qu() {
	first=1

	while read line; do
		if [[ "$first" = 1 ]]; then
			first=0
		else
			echo ' + "\n" +';
		fi

		echo -n "'"
		echo -n "$line" | sed -re "s/[\\\\']/\\\\\\0/g"
		echo -n "'"
	done
}

header() {
	echo
	echo
	echo '/*************************/'
	echo '/* '"$1"' */'
	echo '/*************************/'
	echo
}
js() {
	cd lib

	#header "facilmap_ol_src.js"
	#wget -N https://api.facilmap.org/facilmap_ol_src.js
	#echo
	#
	#header facilmap_ol_src.js
	#cat facilmap_ol_src.js
	#echo
	#
	#echo 'jQuery = $ = FacilMap.$;'

	for i in angular-1.3.8.min.js jquery.ui.spinner-1.10.4.min.js jquery.ui.sortable-1.10.4.min.js ui-sortable-0.13.1.js marked-0.3.2.min.js; do
		header "$i"
		cat "$i"
		echo
	done

	cd ../js
	for i in fp.js $(ls *.js | grep -vF fp.js); do
		header "$i"
		cat "$i"
		echo
	done

	echo 'angular.module("facilpad").run(function($templateCache) {'

	cd ../templates
	for i in *; do
		echo -e '\t'
		echo -n '$templateCache.put(';
		echo "$i" | qu
		echo -n ', '
		cat "$i" | qu
		echo ');'
	done

	echo '});'

	cd ..
}

css() {
	cd lib
	for i in jquery.ui.spinner-1.10.4.min.css; do
		header "$i"
		cat "$i"
		echo
	done

	cd ../css
	for i in *.css; do
		header "$i"
		cat "$i"
		echo
	done

	cd ..
}

js > build/facilpad.js
css > build/facilpad.css

java -jar yuicompressor-2.4.8.jar build/facilpad.js > build/facilpad.min.js
java -jar yuicompressor-2.4.8.jar build/facilpad.css > build/facilpad.min.css