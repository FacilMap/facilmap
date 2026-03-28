<script setup lang="ts">
	import type { LineWithTrackPoints, RouteWithTrackPoints } from "facilmap-client";
	import { createElevationStats, getTranslatedExtraInfoTypes, getTranslatedExtraInfoValues } from "../../utils/heightgraph";
	import Icon from "./icon.vue";
	import { formatAscentDescent, formatDistance } from "facilmap-utils";
	import { computed, ref } from "vue";
	import Popover from "./popover.vue";
	import vTooltip from "../../utils/tooltip";
	import { useI18n } from "../../utils/i18n";
	import { sortBy } from "lodash-es";

	const i18n = useI18n();

	const props = defineProps<{
		route: LineWithTrackPoints | RouteWithTrackPoints;
	}>();

	const translatedTypes = computed(() => getTranslatedExtraInfoTypes());
	const translatedValues = computed(() => getTranslatedExtraInfoValues());

	const stats = computed(() => createElevationStats(props.route.extraInfo ?? {}, props.route.trackPoints));
	const hasStats = computed(() => Object.keys(stats.value).length > 0);

	const tabValue = ref<string>();
	const tab = computed({
		get: () => tabValue.value != null && Object.hasOwn(stats.value, tabValue.value) ? tabValue.value : Object.keys(translatedTypes.value).find((k) => Object.hasOwn(stats.value, k)),
		set: (v) => {
			tabValue.value = v;
		}
	});
	const values = computed(() => tab.value != null ? sortBy(Object.entries(translatedValues.value[tab.value] ?? {}).flatMap(([k, v]) => {
		if (!Object.hasOwn(stats.value[tab.value!], k)) {
			return [];
		}

		return [{
			key: Number(k),
			label: v.text,
			value: `${formatDistance(stats.value[tab.value!][k as `${number}`].distanceKm)} (${stats.value[tab.value!][k as `${number}`].percent}\u202f%)`
		}];
	}), (v) => v.key) : []);

	const statsButtonContainerRef = ref<HTMLElement>();
	const showStatsPopover = ref(false);
</script>

<template>
	<span class="fm-elevation-stats" v-if="route.ascent != null && route.descent != null">
		<span>
			<Icon icon="triangle-top" :alt="i18n.t('elevation-stats.ascent-alt')"></Icon> {{formatAscentDescent(route.ascent)}} / <Icon icon="triangle-bottom" :alt="i18n.t('elevation-status.descent-alt')"></Icon> {{formatAscentDescent(route.descent)}}
		</span>

		<template v-if="hasStats && tab">
			<span ref="statsButtonContainerRef">
				<button
					type="button"
					class="btn btn-secondary"
					v-tooltip="i18n.t('elevation-stats.show-tooltip')"
					@click="showStatsPopover = !showStatsPopover"
				>
					<Icon icon="circle-info" :alt="i18n.t('elevation-stats.show-alt')"></Icon>
				</button>
			</span>

			<Popover
				:element="statsButtonContainerRef"
				v-model:show="showStatsPopover"
				hideOnOutsideClick
				class="fm-elevation-stats-popover"
			>
				<ul class="nav nav-tabs mb-2">
					<template v-for="(v, k) in translatedTypes" :key="k">
						<template v-if="stats[k] != null">
							<li class="nav-item">
								<a
									class="nav-link"
									href="javascript:"
									:class="{ active: tab === k }"
									@click="tab = k"
								>{{v}}</a>
							</li>
						</template>
					</template>
				</ul>

				<dl class="row">
					<template v-for="v in values" :key="v.key">
						<dt>{{v.label}}</dt>
						<dd>{{v.value}}</dd>
					</template>
				</dl>
			</Popover>
		</template>
	</span>
</template>

<style lang="scss">
	.fm-elevation-stats {
		&, & > span {
			display: inline-flex;
			align-items: center;
		}

		button {
			margin-left: 0.5rem;
			padding: 0 0.25rem;
			line-height: 1;
		}
	}

	.fm-elevation-stats-popover {
		max-width: none;

		dl {
			margin: 0;
			display: grid;
			grid-template-columns: auto 1fr;
			white-space: nowrap;
		}
	}
</style>