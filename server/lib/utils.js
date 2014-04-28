var stream = require("stream");

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

function filterStreamAsync(inStream, filterFunction) {
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
				ret.push();
			} else {
				running = true;
				filterFunction(next, function(err, newData) {
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
	for(var i=1; i<arguments.length; i++) {
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

function arraysEqual(a, b) {
	if (a === b) return true;
	if (a == null || b == null) return false;
	if (a.length != b.length) return false;

	for (var i = 0; i < a.length; ++i) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

module.exports = {
	isInBbox : isInBbox,
	filterStream : filterStream,
	filterStreamAsync : filterStreamAsync,
	extend : extend,
	calculateDistance : calculateDistance,
	arraysEqual : arraysEqual
};