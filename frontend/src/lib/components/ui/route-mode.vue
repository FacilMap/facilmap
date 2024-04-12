<script setup lang="ts">
	import type { RouteMode as RouteModeType } from "facilmap-types";
	import { type DecodedRouteMode, decodeRouteMode, encodeRouteMode } from "facilmap-utils";
	import Icon from "./icon.vue";
	import { computed, ref, watch } from "vue";
	import { getUniqueId } from "../../utils/utils";
	import vTooltip, { type TooltipPlacement } from "../../utils/tooltip";
	import DropdownMenu from "../ui/dropdown-menu.vue";
	import { useI18n } from "../../utils/i18n";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";

	type Mode = Exclude<DecodedRouteMode['mode'], 'track'>;
	type Type = DecodedRouteMode['type'];

	const context = injectContextRequired();
	const i18n = useI18n();

	const props = withDefaults(defineProps<{
		modelValue: RouteModeType;
		tabindex?: number;
		disabled?: boolean;
		tooltipPlacement?: TooltipPlacement;
	}>(), {
		tooltipPlacement: "top"
	});

	const emit = defineEmits<{
		"update:modelValue": [value: RouteModeType];
	}>();

	const id = getUniqueId("fm-route-mode");

	const constants = computed((): {
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
	} => ({
		modes: ["car", "bicycle", "pedestrian", ""],

		modeIcon: {
			car: "car",
			bicycle: "person-biking",
			pedestrian: "person-walking",
			"": "slash"
		},

		modeAlt: {
			car: i18n.t("route-mode.car-alt"),
			bicycle: i18n.t("route-mode.bicycle-alt"),
			pedestrian: i18n.t("route-mode.pedestrian-alt"),
			"": i18n.t("route-mode.straight-alt")
		},

		modeTitle: {
			car: i18n.t("route-mode.car-title"),
			bicycle: i18n.t("route-mode.bicycle-title"),
			pedestrian: i18n.t("route-mode.pedestrian-title"),
			"": i18n.t("route-mode.straight-title")
		},

		types: {
			car: ["", "hgv"],
			bicycle: ["", "road", "mountain", "electric"],
			pedestrian: ["", "hiking", "wheelchair"],
			"": [""]
		},

		typeText: {
			car: {
				"": i18n.t("route-mode.car"),
				"hgv": i18n.t("route-mode.hgv")
			},
			bicycle: {
				"": i18n.t("route-mode.bicycle"),
				road: i18n.t("route-mode.road-bike"),
				mountain: i18n.t("route-mode.mountain-bike"),
				electric: i18n.t("route-mode.electric-bike")
			},
			pedestrian: {
				"": i18n.t("route-mode.walking"),
				hiking: i18n.t("route-mode.hiking"),
				wheelchair: i18n.t("route-mode.wheelchair")
			},
			"": {
				"": i18n.t("route-mode.straight")
			}
		},

		preferences: ["fastest", "shortest"],

		preferenceText: {
			fastest: i18n.t("route-mode.fastest"),
			shortest: i18n.t("route-mode.shortest")
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
			highways: i18n.t("route-mode.avoid-highways"),
			tollways: i18n.t("route-mode.avoid-toll-roads"),
			ferries: i18n.t("route-mode.avoid-ferries"),
			fords: i18n.t("route-mode.avoid-fords"),
			steps: i18n.t("route-mode.avoid-steps")
		}
	}));

	const decodedMode = ref(decodeRouteMode(props.modelValue));

	watch(() => props.modelValue, () => {
		decodedMode.value = decodeRouteMode(props.modelValue);
	});

	watch(() => decodedMode.value, () => {
		const newValue = encodeRouteMode(decodedMode.value);
		if (newValue !== props.modelValue) {
			emit("update:modelValue", newValue);
		}
	}, { deep: true });

	const types = computed(() => (Object.keys(constants.value.types) as Mode[]).map((mode) => constants.value.types[mode].map((type) => ([mode, type] as [Mode, Type]))).flat());

	function isTypeActive(mode: DecodedRouteMode['mode'], type: DecodedRouteMode['type']): boolean {
		return (!mode && !decodedMode.value.mode || mode == decodedMode.value.mode) && (!type && !decodedMode.value.type || type == decodedMode.value.type);
	}

	function setMode(mode: DecodedRouteMode['mode'], type: DecodedRouteMode['type']): void {
		decodedMode.value.mode = mode;
		decodedMode.value.type = type;

		if(decodedMode.value.avoid) {
			for(let i=0; i < decodedMode.value.avoid.length; i++) {
				if(!constants.value.avoidAllowed[decodedMode.value.avoid[i]](decodedMode.value.mode, decodedMode.value.type))
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
	<div class="fm-route-mode position-relative">
		<div class="btn-group" role="group">
			<template v-for="(mode, idx) in constants.modes" :key="mode">
				<input
					type="radio"
					class="btn-check"
					:id="`${id}-mode-${mode}`"
					:name="`${id}-mode`"
					v-model="decodedMode.mode"
					:value="mode"
					:tabindex="tabindex != null ? tabindex + idx : undefined"
					:disabled="disabled"
				/>
				<label class="btn btn-secondary" :for="`${id}-mode-${mode}`" v-tooltip:[tooltipPlacement]="constants.modeTitle[mode]">
					<Icon :icon="constants.modeIcon[mode]" :alt="constants.modeAlt[mode]"></Icon>
				</label>
			</template>

			<div v-if="context.settings.advancedRouting" class="btn-group">
				<DropdownMenu
					:tabindex="tabindex != null ? tabindex + constants.modes.length : undefined"
					tooltip="Customize"
					:tooltipPlacement="tooltipPlacement"
					:isDisabled="disabled"
					noWrapper
					menuClass="fm-route-mode-customize"
					maxWidth="32rem"
				>
					<template #label>
						<Icon icon="cog" :alt="i18n.t('route-mode.custom-alt')"/>
					</template>

					<template #default>
						<li>
							<a
								class="dropdown-item"
								href="javascript:"
								@click.capture.stop.prevent="decodedMode.details = !decodedMode.details"
							>
								<Icon :icon="decodedMode.details ? 'check' : 'unchecked'"></Icon> {{i18n.t("route-mode.load-details")}}
							</a>
						</li>

						<li><hr class="dropdown-divider"></li>

						<template v-for="t in types" :key="t.id">
							<li class="column">
								<a
									class="dropdown-item"
									href="javascript:"
									@click.capture.stop.prevent="setMode(t[0], t[1])"
								>
									<Icon :icon="isTypeActive(t[0], t[1]) ? 'check' : 'unchecked'"></Icon> {{constants.typeText[t[0]][t[1]]}}
								</a>
							</li>
						</template>

						<li><hr class="dropdown-divider"></li>

						<template v-for="(pText, p) in constants.preferenceText" :key="p">
							<template v-if="decodedMode.mode">
								<li class="column">
									<a
										class="dropdown-item"
										href="javascript:"
										@click.capture.stop.prevent="decodedMode.preference = p"
									>
										<Icon :icon="decodedMode.preference == p ? 'check' : 'unchecked'"></Icon> {{pText}}
									</a>
								</li>
							</template>
						</template>

						<li><hr class="dropdown-divider"></li>

						<template v-for="avoid in constants.avoid" :key="avoid">
							<template v-if="constants.avoidAllowed[avoid](decodedMode.mode, decodedMode.type)">
								<li class="column">
									<a
										class="dropdown-item"
										href="javascript:"
										@click.capture.stop.prevent="toggleAvoid(avoid)"
									>
										<Icon :icon="decodedMode.avoid.includes(avoid) ? 'check' : 'unchecked'"></Icon> {{constants.avoidText[avoid]}}
									</a>
								</li>
							</template>
						</template>
					</template>
				</DropdownMenu>
			</div>
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