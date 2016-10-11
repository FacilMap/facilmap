var async = require("async");
var utils = require("./utils");

var listeners = { };

function notifyPadListeners(padId, eventType, getData) {
	var isFunc = (typeof getData == "function");

	( listeners[padId] || [ ]).forEach(function(listener) {
		var data = isFunc ? getData(listener) : getData;
		if(data == null)
			return;

		listener.emit(eventType, data);
	});
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

function changePadId(oldPadId, newPadId) {
	if(oldPadId == newPadId)
		return;

	listeners[newPadId] = listeners[oldPadId];
	delete listeners[oldPadId];

	listeners[newPadId].forEach(function(listener) {
		listener.padId = newPadId;
	});
}

module.exports = {
	notifyPadListeners : notifyPadListeners,
	addPadListener : addPadListener,
	removePadListener: removePadListener,
	changePadId: changePadId
};