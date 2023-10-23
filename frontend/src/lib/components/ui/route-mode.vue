<script lang="ts">
	import { RouteMode as RouteModeType } from "facilmap-types";
	import { DecodedRouteMode, decodeRouteMode, encodeRouteMode } from "facilmap-utils";
	import Icon from "./icon.vue";
	import { computed, ref, watch } from "vue";
	import { getUniqueId } from "../../utils/utils";
	import vTooltip from "../../utils/tooltip";

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
			bicycle: "person-biking",
			pedestrian: "person-walking",
			"": "slash"
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
			car: ["", "hgv"],
			bicycle: ["", "road", "mountain", "electric"],
			pedestrian: ["", "hiking", "wheelchair"],
			"": [""]
		},

		typeText: {
			car: {
				"": "Car",
				"hgv": "HGV"
			},
			bicycle: {
				"": "Bicycle",
				road: "Road bike",
				mountain: "Mountain bike",
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

		preferences: ["fastest", "shortest"],

		preferenceText: {
			fastest: "Fastest",
			shortest: "Shortest"
		},

		avoid: ["highways", "tollways", "ferries", "fords", "steps"],

		// driving: highways, tollways, ferries
		// cycling: ferries, steps, fords
		// foot: ferries, fords, steps
		// wheelchair: ferries, steps
		avoidAllowed: {
			highways: (mode) => (mode == "car"),
			tollways: (mode) => (mode == "car"),
			ferries: (mode) => (!!mode),
			fords: (mode, type) => (mode == "bicycle" || (mode == "pedestrian" && type != "wheelchair")),
			steps: (mode) => (mode == "bicycle" || mode == "pedestrian")
		},

		avoidText: {
			highways: "highways",
			tollways: "toll roads",
			ferries: "ferries",
			fords: "fords",
			steps: "steps"
		}
	}
</script>

<script setup lang="ts">
	const props = withDefaults(defineProps<{
		value?: RouteModeType;
		tabindex?: number;
		disabled?: boolean;
		tooltipPlacement?: string;
	}>(), {
		tooltipPlacement: "top"
	});

	const emit = defineEmits<{
		(type: "update", value: RouteModeType): void;
	}>();

	const id = getUniqueId("fm-route-mode");

	const decodedMode = ref(decodeRouteMode(props.value ?? ""));

	watch(() => props.value, () => {
		decodedMode.value = decodeRouteMode(props.value ?? "");
	});

	watch(() => decodedMode.value, () => {
		const newValue = encodeRouteMode(decodedMode.value);
		if (newValue !== props.value) {
			emit("update", newValue);
		}
	});

	const types = computed(() => (Object.keys(constants.types) as Mode[]).map((mode) => constants.types[mode].map((type) => ([mode, type] as [Mode, Type]))).flat());

	function isTypeActive(mode: DecodedRouteMode['mode'], type: DecodedRouteMode['type']): boolean {
		return (!mode && !decodedMode.value.mode || mode == decodedMode.value.mode) && (!type && !decodedMode.value.type || type == decodedMode.value.type);
	}

	function setMode(mode: DecodedRouteMode['mode'], type: DecodedRouteMode['type']): void {
		decodedMode.value.mode = mode;
		decodedMode.value.type = type;

		if(decodedMode.value.avoid) {
			for(let i=0; i < decodedMode.value.avoid.length; i++) {
				if(!constants.avoidAllowed[decodedMode.value.avoid[i]](decodedMode.value.mode, decodedMode.value.type))
					decodedMode.value.avoid.splice(i--, 1);
			}
		}
	}

	function toggleAvoid(avoid: DecodedRouteMode['avoid'][0]): void {
		if(!decodedMode.value.avoid)
			decodedMode.value.avoid = [];

		let idx = decodedMode.value.avoid.indexOf(avoid);
		if(idx == -1)
			decodedMode.value.avoid.push(avoid);
		else
			decodedMode.value.avoid.splice(idx, 1);
	}
</script>

<template>
	<div class="btn-group fm-route-mode" role="group">
		<template v-for="(mode, idx) in constants.modes">
			<input
				type="radio"
				class="btn-check"
				:id="`${id}-mode-${mode}`"
				:name="`${id}-mode`"
				:checked="decodedMode.mode == mode"
				:tabindex="tabindex != null ? tabindex + idx : undefined"
				v-tooltip:[tooltipPlacement]="`Go ${constants.modeTitle[mode]}`"
				:disabled="disabled"
			/>
			<label class="btn btn-light" :for="`${id}-mode-${mode}`">
				<Icon :icon="constants.modeIcon[mode]" :alt="constants.modeAlt[mode]"></Icon>
			</label>
		</template>

		<div class="dropdown fm-route-mode-customize">
			<button
				type="button"
				class="btn btn-light"
				:tabindex="tabindex != null ? tabindex + constants.modes.length : undefined"
				v-tooltip:tooltipPlacement="'Customize'"
				:disabled="disabled"
			>
				<Icon icon="cog" alt="Custom"/>
			</button>

			<ul class="dropdown-menu">
				<li>
					<a
						class="dropdown-item"
						href="javascript:"
						@click.native.capture.stop.prevent="decodedMode.details = !decodedMode.details"
					>
						<Icon :icon="decodedMode.details ? 'check' : 'unchecked'"></Icon> Load route details (elevation, road types, …)
					</a>
				</li>

				<li><hr class="dropdown-divider"></li>

				<template v-for="t in types">
					<li>
						<a
							class="dropdown-item column"
							href="javascript:"
							@click.native.capture.stop.prevent="setMode(t[0], t[1])"
						>
							<Icon :icon="isTypeActive(t[0], t[1]) ? 'check' : 'unchecked'"></Icon> {{constants.typeText[t[0]][t[1]]}}
						</a>
					</li>
				</template>

				<li><hr class="dropdown-divider"></li>

				<template v-for="(pText, p) in constants.preferenceText">
					<template v-if="decodedMode.mode">
						<li>
							<a
								class="dropdown-item column"
								href="javascript:"
								@click.native.capture.stop.prevent="decodedMode.preference = p"
							>
								<Icon :icon="decodedMode.preference == p ? 'check' : 'unchecked'"></Icon> {{pText}}
							</a>
						</li>
					</template>
				</template>

				<li><hr class="dropdown-divider"></li>

				<template v-for="avoid in constants.avoid">
					<template v-if="constants.avoidAllowed[avoid](decodedMode.mode, decodedMode.type)">
						<li>
							<a
								class="dropdown-item column"
								href="javascript:"
								@click.native.capture.stop.prevent="toggleAvoid(avoid)"
							>
								<Icon :icon="decodedMode.avoid.includes(avoid) ? 'check' : 'unchecked'"></Icon> Avoid {{constants.avoidText[avoid]}}
							</a>
						</li>
					</template>
				</template>
			</ul>
		</div>
	</div>
</template>

<style lang="scss">
	.fm-route-mode {
		.btn-group .btn {
			padding-left: 10px;
			padding-right: 10px;
		}
	}

	.fm-route-mode-customize {
		width: 380px;
		font-size: 0; /* https://stackoverflow.com/a/5647640/242365 */

		li {
			font-size: 14px;

			&.column {
				display: inline-block;
				width: 50%;
			}
		}
	}
</style>