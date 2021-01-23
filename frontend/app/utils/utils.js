import fm from '../app';
import 'leaflet-geometryutil';
import linkifyStr from 'linkifyjs/string';

fm.app.filter('fmObjectFilter', function($filter){
	return function(input, query) {
		if(!query) return input;

		var output = { };

		for(var i in input) {
			if($filter("filter")([ input[i] ], query).length == 1)
				output[i] = input[i];
		}

		return output;
	};
});

fm.app.filter('fmPropertyCount', function($filter) {
	return function(input, query) {
		if(!input)
			return 0;
		else if(!query)
			return Object.keys(input).length;
		else
			return Object.keys($filter('fmObjectFilter')(input, query)).length;
	};
});

fm.app.filter('fmRenderOsmTag', function($sce, fmUtils) {
	return function(value, key) {
		[key, value] = [`${key}`, `${value}`];
		if(key.match(/^wikipedia(:|$)/)) {
			return $sce.trustAsHtml(value.split(";").map(function(it) {
				var m = it.match(/^(\s*)((([-a-z]+):)?(.*))(\s*)$/);
				var url = "https://" + (m[4] || "en") + ".wikipedia.org/wiki/" + m[5];
				return m[1] + '<a href="' + fmUtils.quoteHtml(url) + '" target="_blank">' + fmUtils.quoteHtml(m[2]) + '</a>' + m[6];
			}).join(";"));
		} else if(key.match(/^wikidata(:|$)/)) {
			return $sce.trustAsHtml(value.split(";").map(function(it) {
				var m = it.match(/^(\s*)(.*?)(\s*)$/);
				return m[1] + '<a href="https://www.wikidata.org/wiki/' + fmUtils.quoteHtml(m[2]) + '" target="_blank">' + fmUtils.quoteHtml(m[2]) + '</a>' + m[3];
			}).join(";"));
		} else if(key.match(/^wiki:symbol(:$)/)) {
			return $sce.trustAsHtml(value.split(";").map(function(it) {
				var m = it.match(/^(\s*)(.*?)(\s*)$/);
				return m[1] + '<a href="https://wiki.openstreetmap.org/wiki/Image:' + fmUtils.quoteHtml(m[2]) + '" target="_blank">' + fmUtils.quoteHtml(m[2]) + '</a>' + m[3];
			})).join(";");
		} else {
			return $sce.trustAsHtml(linkifyStr(value));
		}
	};
});

fm.app.filter('fmNumberArray', function() {
	return function(value, key) {
		var ret = [ ];
		for(var i=0; i<value; i++)
			ret.push(i);
		return ret;
	};
});

fm.app.filter('fmRound', function(fmUtils) {
	return function(value, key) {
		return fmUtils.round(value, key);
	};
});

fm.app.filter('fmFormatTime', function(fmUtils) {
	return function(value, key) {
		return fmUtils.formatTime(value);
	};
});

fm.app.filter('fmRoutingMode', function(fmUtils) {
	return function(value) {
		return fmUtils.formatRouteMode(value);
	};
});

fm.app.filter('fmOrderBy', function($filter) {
	return function(value, key) {
		return $filter('orderBy')(Object.keys(value).map(function(i) { return value[i]; }), key);
	};
});
