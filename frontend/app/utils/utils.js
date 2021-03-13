import fm from '../app';
import 'leaflet-geometryutil';

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

fm.app.filter('fmOrderBy', function($filter) {
	return function(value, key) {
		return $filter('orderBy')(Object.keys(value).map(function(i) { return value[i]; }), key);
	};
});
