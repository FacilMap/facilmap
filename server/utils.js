var stream = require("stream");
var util = require("util");
var Promise = require("promise");

function isInBbox(position, bbox) {
	if(position.lat > bbox.top || position.lat < bbox.bottom)
		return false;
	if(bbox.right < bbox.left) // bbox spans over lon = 180
		return (position.lon > bbox.left || position.lon < bbox.right);
	else
		return (position.lon > bbox.left && position.lon < bbox.right);
}

function filterStream(inStream, filterFunction) {
	var ret = new stream.Readable({ objectMode: true });
	inStream.on("data", function(data) {
		var data = filterFunction(data);
		if(data != null)
			ret.push(data);
	}).on("end", function() {
		ret.push();
	}).on("error", function(err) {
		ret.emit("error", err);
	});

	ret._read = function() {
	};

	return ret;
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
				Promise.nodeify(filterFunction)(next, function(err, newData) {
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
		return isNaN(obj = 1*obj) ? FAILURE : obj;
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

module.exports = {
	isInBbox : isInBbox,
	filterStream : filterStream,
	filterStreamPromise : filterStreamPromise,
	extend : extend,
	calculateDistance : calculateDistance,
	generateRandomId : generateRandomId,
	stripObject : stripObject,
	ArrayStream : ArrayStream,
	streamEachPromise : streamEachPromise,
	escapeXml : escapeXml,
	isoDate : isoDate,
	round: round
};