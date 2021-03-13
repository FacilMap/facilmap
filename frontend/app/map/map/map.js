
			this.mapEvents = $rootScope.$new(true); /* Event types: longmousedown, layerchange, routeDestinationRemove, routeDestinationMove, routePointMouseOver, routePointMouseOut, showObject, searchchange */

			if(L.Browser.touch && !L.Browser.pointer) {
				// Long click will call the contextmenu event
				this.map.on("contextmenu", ((e) => {
					this.mapEvents.$broadcast("longmousedown", e.latlng);
				}).fmWrapApply($scope));
			} else {
				fmUtils.onLongMouseDown(this.map, ((e) => {
					this.mapEvents.$broadcast("longmousedown", e.latlng);
				}).fmWrapApply($scope));
			}
