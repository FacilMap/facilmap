var async = require("async");
var utils = require("./utils");

var listeners = { };

function notifyPadListeners(padId, position, eventType, data) {
	getPadListeners(padId, position).forEach(function(it) {
		it.emit(eventType, data);
	});
}

function getPadListeners(padId, position) {
	if(listeners[padId] == null)
		return [ ];

	if(position == null) {
		return [ ].concat(listeners[padId]);
	}

	var ret = [ ];
	listeners[padId].forEach(function(it) {
		if(it.bbox && utils.isInBbox(position, it.bbox))
			ret.push(it);
	});
	return ret;
}

function addPadListener(listener) {
	if(listeners[listener.padId] == null)
		listeners[listener.padId] = [ ];

	listeners[listener.padId].push(listener);
}

function removePadListener(listener) {
	var l = listeners[listener.padId];
	if(l == null)
		return;

	var idx = l.indexOf(listener);
	if(idx == -1)
		return;

	listeners[listener.padId] = l.slice(0, idx).concat(l.slice(idx+1));
}

module.exports = {
	notifyPadListeners : notifyPadListeners,
	getPadListeners : getPadListeners,
	addPadListener : addPadListener,
	removePadListener: removePadListener
};