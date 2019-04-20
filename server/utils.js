var stream = require("stream");
var util = require("util");
var Promise = require("bluebird");
var es = require("event-stream");
var combine = require("stream-combiner");
var commonUtils = require("facilmap-frontend/common/utils");

function isInBbox(position, bbox) {
	if(position.lat > bbox.top || position.lat < bbox.bottom)
		return false;
	if(bbox.right < bbox.left) // bbox spans over lon = 180
		return (position.lon > bbox.left || position.lon < bbox.right);
	else
		return (position.lon > bbox.left && position.lon < bbox.right);
}

function filterStreamPromise(inStream, filterFunction) {
	var error = false;

	var ret = new stream.Readable({ objectMode: true });

	var running = false;
	var queue = [ ];

	function handleQueue() {
		if(error || running)
			return;

		if(queue.length > 0) {
			var next = queue.shift();
			if(next == null) {
				ret.push(null);
			} else {
				running = true;
				Promise.resolve(filterFunction(next)).nodeify(function(err, newData) {
					running = false;

					if(error)
						return;

					if(err) {
						error = true;
						ret.emit("error", err);
					} else if(newData != null) {
						ret.push(newData);
					}

					setImmediate(handleQueue);
				});
			}
		}
	}

	inStream.on("data", function(data) {
		if(data != null)
			queue.push(data);
		handleQueue();
	}).on("end", function() {
		queue.push(null);
		handleQueue();
	}).on("error", function(err) {
		ret.emit("error", err);
	});

	ret._read = function() {
	};

	return ret;
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

function distanceToDegreesLat(km) {
	return km / (R * Math.PI / 180);
}

function distanceToDegreesLon(km, lat) {
	let fac = Math.cos(lat * Math.PI / 180);
	return km / (fac * R * Math.PI / 180)
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
		return Promise.props(deps);
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


/**
 * Intercepts the "write" and "end" methods of the given writable stream and buffers the values written to them instead.
 * When the stream ends, the buffered value is returned and the original "write" and "end" methods are restored.
 * @param writeStream {stream.Writable}
 * @returns {Promise.<string>}
 */
function interceptWriteStream(writeStream) {
	return new Promise((resolve, reject) => {
		let response = "";
		let writeBkp = writeStream.write;
		let sendBkp = writeStream.send; // For express response streams
		let endBkp = writeStream.end;

		writeStream.write = function(chunk, encoding, callback) {
			response += chunk;

			if(typeof encoding == "function") {
				encoding();
			} else if(callback) {
				callback();
			}
			return true;
		};

		writeStream.send = function(body) {
			writeStream.end(body);
		};

		writeStream.end = function(chunk, encoding, callback) {
			if(chunk) {
				response += chunk;
			}

			writeStream.write = writeBkp;
			writeStream.send = sendBkp;
			writeStream.end = endBkp;

			if(typeof encoding == "function") {
				writeStream.once("finish", encoding);
			} else if(callback) {
				writeStream.once("finish", encoding);
			}

			resolve(response);
		};
	});
}

function calculateBbox(trackPoints) {
	let bbox = { top: null, left: null, right: null, bottom: null };

	for(let trackPoint of trackPoints) {
		if(bbox.top == null || trackPoint.lat > bbox.top)
			bbox.top = trackPoint.lat;
		if(bbox.bottom == null || trackPoint.lat < bbox.bottom)
			bbox.bottom = trackPoint.lat;
		if(bbox.left == null || trackPoint.lon < bbox.left)
			bbox.left = trackPoint.lon;
		if(bbox.right == null || trackPoints.lon > bbox.right)
			bbox.right = trackPoint.lon;
	}

	return bbox;
}

module.exports = {
	isInBbox : isInBbox,
	filterStreamPromise : filterStreamPromise,
	extend : extend,
	calculateDistance : commonUtils.calculateDistance,
	distanceToDegreesLat,
	distanceToDegreesLon,
	generateRandomId : generateRandomId,
	stripObject : stripObject,
	ArrayStream : ArrayStream,
	streamEachPromise : streamEachPromise,
	escapeXml : escapeXml,
	isoDate : isoDate,
	round: round,
	streamToArrayPromise: streamToArrayPromise,
	promiseAuto: promiseAuto,
	modifyFunction: modifyFunction,
	interceptWriteStream: interceptWriteStream,
	calculateBbox
};