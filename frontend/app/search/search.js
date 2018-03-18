import fm from '../app';
import css from './search.scss';

fm.app.directive("fmSearch", function(fmSearchFileImport) {
	return {
		restrict: "E",
		require: {
			map: "^facilmap"
		},
		scope: {
			autofocus: "<autofocus"
		},
		replace: true,
		template: require("./search.html"),
		bindToController: true,
		controller: function($scope, $element) { this.$onInit = () => {
			const map = this.map;

			$scope.client = map.client;
			$scope.className = css.className;
			$scope.ctrl = this;

			if($scope.autofocus == null)
				$scope.autofocus = (window === parent);

			$scope.isRouteShown = null;

			$scope.$watch(() => {
				return !$scope.isRouteShown ? this.queryUi.hasResults() : false;
			}, (hasResults) => {
				$scope.hasResults = hasResults;
			});

			var searchUi = map.searchUi = {
				showQuery: () => {
					if($scope.isRouteShown == false)
						return;

					this.routeUi.hide();
					this.queryUi.show();
					$scope.isRouteShown = false;
					map.mapEvents.$broadcast("searchchange");
				},

				showRoute: () => {
					if($scope.isRouteShown == true)
						return;

					this.queryUi.hide();
					this.routeUi.show();
					$scope.isRouteShown = true;
					map.mapEvents.$broadcast("searchchange");
				},

				search: (query, noZoom, showAll) => {
					searchUi.showQuery();

					this.queryUi.search(query, noZoom, showAll);
				},

				showFiles: (files) => {
					searchUi.showQuery();

					this.queryUi.showFiles(files);
				},

				route: (destinations, mode, noZoom, noSubmit) => {
					searchUi.showRoute();

					this.routeUi.setQueries(destinations);
					if(mode)
						this.routeUi.setMode(mode);

					if(!noSubmit)
						this.routeUi.submit(noZoom);
				},

				setRouteDestination: (query, mode, _results, _result) => {
					searchUi.showRoute();

					if(mode == 1)
						this.routeUi.setFrom(query, _results, _result);
					else if(mode == 2)
						this.routeUi.addVia(query, _results, _result);
					else if(mode == 3)
						this.routeUi.setTo(query, _results, _result);

					this.routeUi.submit(!!this.routeUi.getQueries());
				},

				getSubmittedSearch: () => {
					if(!$scope.isRouteShown)
						return this.queryUi.getSubmittedSearch();
					else
						return this.routeUi.getSubmittedSearch();
				},

				isZoomedToSubmittedSearch: () => {
					if(!$scope.isRouteShown)
						return this.queryUi.isZoomedToSubmittedSearch();
					else
						return this.routeUi.isZoomedToSubmittedSearch();
				}
			};


			map.importUi = fmSearchFileImport(map);

			$scope.$on("$destroy", () => {
				map.searchUi = null;
				map.importUi = null;
			});
		} },
		link: function(scope, el, attrs, ctrl) {
			ctrl.map.searchUi.showQuery();
		}
	};
});