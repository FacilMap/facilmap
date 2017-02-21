import fm from '../app';
import $ from 'jquery';
import Client from 'facilmap-client';

// From http://stackoverflow.com/a/11277751/242365
fm.app.factory("fmSocket", function($rootScope, $q, fmFilter) {
	return function(serverUrl, padId) {
		let fmSocket = $rootScope.$new();

		// All the Client methods used to be defined here before they were moved into a separate module. Because many
		// parts of the code rely on fmSocket.$watch(), we merge the Client methods back into the scope. Maybe in the
		// future this can be implemented in a better way.

		for(let i of Object.getOwnPropertyNames(Client.prototype))
			fmSocket[i] = Client.prototype[i];

		$.extend(fmSocket, {
			filterExpr: null,
			filterFunc: fmFilter.compileExpression(null),

			setFilter(filter) {
				this.filterExpr = filter && filter.trim();

				let filterFunc = fmFilter.compileExpression(filter);
				this.filterFunc = function(obj, doNotPrepare) {
					if(!doNotPrepare)
						obj = fmFilter.prepareObject(obj, obj ? this.types[obj.typeId] : null);
					return filterFunc(obj);
				};

				this._simulateEvent("filter");
			},

			_emit(eventName, data) {
				return $q.resolve(Client.prototype._emit.apply(this, arguments));
			},

			_simulateEvent(eventName, data) {
				return Client.prototype._simulateEvent.fmWrapApply(fmSocket).apply(this, arguments);
			}
		});

		fmSocket.$on("$destroy", () => {
			fmSocket.disconnect();
		});

		fmSocket._init(serverUrl, padId);

		return fmSocket;
	};
});
