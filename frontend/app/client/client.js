import fm from '../app';
import Client from 'facilmap-client';

// From http://stackoverflow.com/a/11277751/242365
fm.app.factory("fmClient", function($rootScope, $q, fmFilter) {
	return class FmClient extends Client {
		constructor(server, padId) {
			super(server, padId);

			this.setFilter(null);
		}

		setFilter(filter) {
			this.filterExpr = filter && filter.trim();

			let filterFunc = fmFilter.compileExpression(filter);
			this.filterFunc = function(obj, doNotPrepare) {
				if(!doNotPrepare)
					obj = fmFilter.prepareObject(obj, obj ? this.types[obj.typeId] : null);
				return filterFunc(obj);
			};

			this._simulateEvent("filter");
		}

		_emit(eventName, data) {
			return $q.resolve(super._emit(...arguments));
		}

		_simulateEvent(eventName, data) {
			return (() => {
				return super._simulateEvent(...arguments);
			}).fmWrapApply($rootScope)();
		}

		awaitPadData() {
			if(this.padData)
				return $q.resolve();

			return $q((resolve) => {
				let watcher = $rootScope.$watch(() => {
					if(this.padData) {
						watcher();

						// Execute delayed, so that event handlers for lines, types, views, etc. are executed first
						setTimeout(resolve, 0);
					}
				}, () => {});
			});
		}
	};
});
