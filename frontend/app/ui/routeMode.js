import fm from "../app";
import css from "./routeMode.scss";
import commonRouting from "../../common/routing";

fm.app.constant("fmRouteModeConstants", {
	modes: ["car", "bicycle", "pedestrian", ""],

	modeIcon: {
		car: "car",
		bicycle: "bicycle",
		pedestrian: "walk",
		"": "share"
	},

	modeAlt: {
		car: "Car",
		bicycle: "Bicycle",
		pedestrian: "Foot",
		"": "Straight"
	},

	modeTitle: {
		car: "by car",
		bicycle: "by bicycle",
		pedestrian: "on foot",
		"": "in a straight line"
	},

	types: {
		car: [""],
		bicycle: ["", "road", "safe", "mountain", "tour", "electric"],
		pedestrian: ["", "hiking", "wheelchair"],
		"": [""]
	},

	typeText: {
		car: {
			"": "Car"
		},
		bicycle: {
			"": "Bicycle",
			road: "Road bike",
			safe: "Safe cycling",
			mountain: "Mountain bike",
			tour: "Touring bike",
			electric: "Electric bike"
		},
		pedestrian: {
			"": "Walking",
			hiking: "Hiking",
			wheelchair: "Wheelchair"
		},
		"": {
			"": "Straight line"
		}
	},

	preferences: ["fastest", "shortest", "recommended"],

	preferenceText: {
		fastest: "Fastest",
		shortest: "Shortest",
		recommended: "Recommended"
	},

	avoid: ["highways", "tollways", "ferries", "tunnels", "pavedroads", "unpavedroads", "tracks", "fords", "steps", "hills"],

	avoidAllowed: {
		highways: (mode, type) => (mode == "car"),
		tollways: (mode, type) => (mode == "car"),
		ferries: (mode, type) => (!!mode),
		tunnels: (mode, type) => (mode == "car"),
		pavedroads: (mode, type) => (mode == "car" || mode == "bicycle"),
		unpavedroads: (mode, type) => (mode == "car" || mode == "bicycle"),
		tracks: (mode, type) => (mode == "car"),
		fords: (mode, type) => (!!mode && (mode != "pedestrian" || type != "wheelchair")),
		steps: (mode, type) => (mode && mode != "car"),
		hills: (mode, type) => (mode && mode != "car" && (mode != "pedestrian" || type != "wheelchair"))
	},

	avoidText: {
		highways: "highways",
		tollways: "toll roads",
		ferries: "ferries",
		tunnels: "tunnels",
		pavedroads: "paved roads",
		unpavedroads: "unpaved roads",
		tracks: "tracks",
		fords: "fords",
		steps: "steps",
		hills: "hills"
	}
});


fm.app.directive("fmRouteMode", function(fmRouteModeConstants) {
	return {
		restrict: "E",
		scope: {
			encodedMode: "=ngModel",
			tabindex: "<fmTabindex"
		},
		template: require("./routeMode.html"),
		link: (scope, el, attrs) => {
			scope.className = css.className;

			scope.constants = fmRouteModeConstants;

			if(scope.encodedMode == null)
				scope.encodedMode = "car";

			scope.decodedMode = commonRouting.decodeMode(scope.encodedMode);

			scope.$watch("encodedMode", (encodedMode) => {
				scope.decodedMode = commonRouting.decodeMode(encodedMode);
			});

			scope.$watch("decodedMode", (decodedMode) => {
				scope.encodedMode = commonRouting.encodeMode(decodedMode);
			}, true);

			scope.types = [];
			for(let mode in fmRouteModeConstants.types) {
				scope.types.push(...fmRouteModeConstants.types[mode].map((type) => ([mode, type])));
			}

			scope.isTypeActive = (mode, type) => {
				return (!mode && !scope.decodedMode.mode || mode == scope.decodedMode.mode) && (!type && !scope.decodedMode.type || type == scope.decodedMode.type);
			};

			scope.setMode = (mode, type) => {
				scope.decodedMode.mode = mode;
				scope.decodedMode.type = type;

				if(scope.decodedMode.avoid) {
					for(let i=0; i < scope.decodedMode.avoid.length; i++) {
						if(!fmRouteModeConstants.avoidAllowed[scope.decodedMode.avoid[i]](scope.mode, scope.decodedMode.type))
							scope.decodedMode.avoid.splice(i--, 1);
					}
				}
			};

			scope.toggleAvoid = (avoid) => {
				if(!scope.decodedMode.avoid)
					scope.decodedMode.avoid = [];

				let idx = scope.decodedMode.avoid.indexOf(avoid);
				if(idx == -1)
					scope.decodedMode.avoid.push(avoid);
				else
					scope.decodedMode.avoid.splice(idx, 1);
			};

			scope.$watch(() => (el[0].hasAttribute("disabled")), (disabled) => {
				scope.disabled = disabled;
			});
		}
	};
});