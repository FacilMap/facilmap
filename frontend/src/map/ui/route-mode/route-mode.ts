import Vue from "vue";
import { Component, Prop, Watch } from "vue-property-decorator";
import WithRender from "./route-mode.vue";
import { RouteMode as RouteModeType } from "facilmap-types";
import { DecodedRouteMode, decodeRouteMode, encodeRouteMode } from "facilmap-utils";
import Icon from "../icon/icon";
import "./route-mode.scss";

type Mode = Exclude<DecodedRouteMode['mode'], 'track'>;
type Type = DecodedRouteMode['type'];

const constants: {
	modes: Array<Mode>;
	modeIcon: Record<Mode, string>;
	modeAlt: Record<Mode, string>;
	modeTitle: Record<Mode, string>;
	types: Record<Mode, Array<Type>>;
	typeText: Record<Mode, Partial<Record<Type, string>>>;
	preferences: Array<DecodedRouteMode['preference']>;
	preferenceText: Record<DecodedRouteMode['preference'], string>;
	avoid: DecodedRouteMode['avoid'];
	avoidAllowed: Record<DecodedRouteMode['avoid'][0], (mode: DecodedRouteMode['mode'], type: Type) => boolean>;
	avoidText: Record<DecodedRouteMode['avoid'][0], string>;
} = {
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
		highways: (mode) => (mode == "car"),
		tollways: (mode) => (mode == "car"),
		ferries: (mode) => (!!mode),
		tunnels: (mode) => (mode == "car"),
		pavedroads: (mode) => (mode == "car" || mode == "bicycle"),
		unpavedroads: (mode) => (mode == "car" || mode == "bicycle"),
		tracks: (mode) => (mode == "car"),
		fords: (mode, type) => (!!mode && (mode != "pedestrian" || type != "wheelchair")),
		steps: (mode) => (!!mode && mode != "car"),
		hills: (mode, type) => (!!mode && mode != "car" && (mode != "pedestrian" || type != "wheelchair"))
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
}

@WithRender
@Component({
	components: { Icon }
})
export default class RouteMode extends Vue {

	constants = constants;

	@Prop({ type: String }) value?: RouteModeType;
	@Prop({ type: Number }) tabindex?: number;
	@Prop({ type: Boolean }) disabled?: boolean;

	decodedMode: DecodedRouteMode = null as any;

	created(): void {
		this.decodedMode = decodeRouteMode(this.value ?? "car");
	}

	@Watch("value")
	handleValueChange(newMode: RouteModeType): void {
		this.decodedMode = decodeRouteMode(this.value ?? "car");
	}

	@Watch("decodedMode", { deep: true })
	handleModeChange(newMode: DecodedRouteMode, oldMode: DecodedRouteMode): void {
		this.$emit("input", encodeRouteMode(this.decodedMode));
	}

	get types(): Array<[Mode, Type]> {
		return (Object.keys(constants.types) as Mode[]).map((mode) => constants.types[mode].map((type) => ([mode, type] as [Mode, Type]))).flat();
	}

	isTypeActive(mode: DecodedRouteMode['mode'], type: DecodedRouteMode['type']): boolean {
		return (!mode && !this.decodedMode.mode || mode == this.decodedMode.mode) && (!type && !this.decodedMode.type || type == this.decodedMode.type);
	}

	setMode(mode: DecodedRouteMode['mode'], type: DecodedRouteMode['type']): void {
		this.decodedMode.mode = mode as any;
		this.decodedMode.type = type as any;

		if(this.decodedMode.avoid) {
			for(let i=0; i < this.decodedMode.avoid.length; i++) {
				if(!constants.avoidAllowed[this.decodedMode.avoid[i]](this.decodedMode.mode, this.decodedMode.type))
					this.decodedMode.avoid.splice(i--, 1);
			}
		}
	}

	toggleAvoid(avoid: DecodedRouteMode['avoid'][0]): void {
		if(!this.decodedMode.avoid)
			this.decodedMode.avoid = [];

		let idx = this.decodedMode.avoid.indexOf(avoid);
		if(idx == -1)
			this.decodedMode.avoid.push(avoid);
		else
			this.decodedMode.avoid.splice(idx, 1);
	}

}