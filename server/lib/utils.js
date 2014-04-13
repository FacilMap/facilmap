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
		ret.push(filterFunction(data));
	}).on("end", function() {
		ret.push();
	}).on("error", function(err) {
		ret.emit("error", err);
	});

	ret._read = function() {
	};

	return ret;
}

module.exports = {
	isInBbox : isInBbox,
	filterStream : filterStream
};