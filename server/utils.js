var stream = require("stream");
var util = require("util");
var Promise = require("promise");
var es = require("event-stream");
var combine = require("stream-combiner");

function isInBbox(position, bbox) {
	if(position.lat > bbox.top || position.lat < bbox.bottom)
		return false;
	if(bbox.right < bbox.left) // bbox spans over lon = 180
		return (position.lon > bbox.left || position.lon < bbox.right);
	else
		return (position.lon > bbox.left && position.lon < bbox.right);
}

function filterStreamPromise(inStream, filterFunction) {
	return combine(
		inStream,
		es.map(function(data, callback) {
			filterFunction(data).then(function(newData) {
				if(newData == null)
					callback();
				else
					callback(null, newData);
			}).catch(callback);
		})
	);
}

function extend(obj1, obj2) {
	if(obj1 == null)
		return null;

	for(var i=1; i<arguments.length; i++) {
		if(arguments[i] == null)
			continue;

		for(var j in arguments[i]) {
			obj1[j] = arguments[i][j];
		}
	}
	return obj1;
}

function calculateDistance(posList) {
	// From http://stackoverflow.com/a/365853/242365

	var R = 6371; // km
	var ret = 0;

	for(var i=1; i<posList.length; i++) {
		var lat1 = posList[i-1].lat * Math.PI / 180;
		var lon1 = posList[i-1].lon * Math.PI / 180;
		var lat2 = posList[i].lat * Math.PI / 180;
		var lon2 = posList[i].lon * Math.PI / 180;
		var dLat = lat2-lat1;
		var dLon = lon2-lon1;

		var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
		        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
		var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
		ret += R * c;
	}

	return ret;
}

var LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateRandomId(length) {
	var randomPadId = "";
	for(var i=0; i<length; i++) {
		randomPadId += LETTERS[Math.floor(Math.random() * LETTERS.length)];
	}
	return randomPadId;
}

var FAILURE = { };

function stripObject(obj, structure) {
	return _stripObject(obj, structure) !== FAILURE;
}

function _stripObject(obj, type) {
	if(obj === undefined)
		return obj;
	else if(obj === null)
		return obj;
	else if(type instanceof Array) {
		if(!(obj instanceof Array))
			return FAILURE;

		for(var i=0; i<obj.length; i++) {
			if((obj[i] = _stripObject(obj[i], type[0])) === FAILURE)
				return FAILURE;
		}
		return obj;
	}
	else if(typeof type == "function")
		return (obj instanceof type) ? obj : FAILURE;
	else if(type instanceof Object) {
		if(!(obj instanceof Object))
			return FAILURE;

		for(var i in obj) {
			if(type[i] == null || obj[i] === undefined)
				delete obj[i];
			else if((obj[i] = _stripObject(obj[i], type[i])) === FAILURE)
				return FAILURE;
		}
		return obj;
	}
	else if(type == "number" && typeof obj == "string")
		return obj == "" ? null : isNaN(obj = 1*obj) ? FAILURE : obj;
	else if(type == "string" && typeof obj == "number")
		return ""+obj;
	else if(typeof type == "string")
		return (typeof obj == type) ? obj : FAILURE;
	else
		return FAILURE;
}

function ArrayStream(array) {
	stream.Readable.call(this, { objectMode: true });

	if(array != null)
		setImmediate(function(){ this.receiveArray(null, array); }.bind(this));
}

util.inherits(ArrayStream, stream.Readable);

ArrayStream.prototype._read = function(size) {
};

ArrayStream.prototype.receiveArray = function(err, array) {
	if(err)
		return this.emit("error", err);

	for(var i=0; i<array.length; i++)
		this.push(array[i]);
	this.push(null);
};

function streamEachPromise(stream, handle) {
	return new Promise(function(resolve, reject) {
		var ended = false;
		var error = false;
		var reading = false;

		var read = function() {
			if(error)
				return reject(error);

			reading = true;

			var item = stream.read();
			if(item != null)
				Promise.resolve().then(function() { return handle(item) }).then(read, reject);
			else if(!ended) {
				reading = false;
				stream.once("readable", read);
			}
			else
				resolve();
		};

		stream.on("end", function() {
			ended = true;

			if(!reading)
				read();
		});

		stream.on("error", function(err) {
			error = err;

			if(!reading)
				read();
		});

		read();
	});
}

function escapeXml(str) {
	return ("" + str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function isoDate(date) {
	if(!date)
		date = new Date();

	function pad(number, length) {
		number = "" + number;
		while(number.length < length)
			number = "0" + number;
		return number;
	}

	return pad(date.getUTCFullYear(), 4) + '-' + pad(date.getUTCMonth()+1, 2) + '-' + pad(date.getUTCDate(), 2) + 'T' + pad(date.getUTCHours(), 2) + ':' + pad(date.getUTCMinutes(), 2) + ':' + pad(date.getUTCSeconds(), 2) + 'Z';
}

function round(number, digits) {
	var fac = Math.pow(10, digits);
	return Math.round(number*fac)/fac;
}

function streamToArrayPromise(stream) {
	return new Promise(function(resolve, reject) {
		var writer = es.writeArray(function(err, array) {
			if(err)
				reject(err);
			else
				resolve(array);
		});

		stream.pipe(writer);
		stream.on("error", reject);
	});
}

function promiseAllObject(obj) {
	var keys = [ ];
	var values = [ ];
	for(var i in obj) {
		keys.push(i);
		values.push(Promise.resolve(obj[i]));
	}

	return Promise.all(values).then(function(objs) {
		var ret = { };
		for(var i=0; i<objs.length; i++)
			ret[keys[i]] = objs[i];
		return ret;
	});
}

function promiseAuto(obj) {
	var promises = { };

	function _get(str) {
		if(!obj[str])
			throw new Error("Invalid dependency '" + str + "' in promiseAuto().");

		if(promises[str])
			return promises[str];

		if(obj[str].then)
			return obj[str];

		var params = getFuncParams(obj[str]);
		return promises[str] = _getDeps(params).then(function(res) {
			return obj[str].apply(null, params.map(function(param) { return res[param]; }));
		});
	}

	function _getDeps(arr) {
		var deps = { };
		arr.forEach(function(it) {
			deps[it] = _get(it);
		});
		return promiseAllObject(deps);
	}

	return _getDeps(Object.keys(obj));
}

function getFuncParams(func) {
	// Taken from angular injector code

	var ARROW_ARG = /^([^\(]+?)\s*=>/;
	var FN_ARGS = /^[^\(]*\(\s*([^\)]*)\)/m;
	var FN_ARG_SPLIT = /\s*,\s*/;
	var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

	var fnText = (Function.prototype.toString.call(func) + ' ').replace(STRIP_COMMENTS, '');
	var params = (fnText.match(ARROW_ARG) || fnText.match(FN_ARGS))[1];
	return params == "" ? [ ] : params.split(FN_ARG_SPLIT);
}

function modifyFunction(obj, prop, before, after) {
	var bkp = obj[prop];
	obj[prop] = function() {
		before && before.apply(this, arguments);
		var ret = bkp.apply(this, arguments);
		after && after.apply(this, arguments);
		return ret;
	};
}

module.exports = {
	isInBbox : isInBbox,
	filterStreamPromise : filterStreamPromise,
	extend : extend,
	calculateDistance : calculateDistance,
	generateRandomId : generateRandomId,
	stripObject : stripObject,
	ArrayStream : ArrayStream,
	streamEachPromise : streamEachPromise,
	escapeXml : escapeXml,
	isoDate : isoDate,
	round: round,
	streamToArrayPromise: streamToArrayPromise,
	promiseAllObject: promiseAllObject,
	promiseAuto: promiseAuto,
	modifyFunction: modifyFunction
};