<script setup lang="ts">
	import { sortBy } from "lodash-es";
	import type { LineWithTrackPoints, RouteWithTrackPoints } from "facilmap-client";
	import { createElevationStats } from "../../utils/heightgraph";
	import Icon from "./icon.vue";
	import { numberKeys, round } from "facilmap-utils";
	import { computed, ref } from "vue";
	import Popover from "./popover.vue";
	import vTooltip from "../../utils/tooltip";

	const props = defineProps<{
		route: LineWithTrackPoints | RouteWithTrackPoints;
	}>();

	const statsButtonContainerRef = ref<HTMLElement>();
	const showStatsPopover = ref(false);

	const statsArr = computed(() => {
		const stats = createElevationStats(props.route.extraInfo ?? {}, props.route.trackPoints)
		return stats && sortBy([...numberKeys(stats)].map((i) => ({ i, distance: stats[i] })), 'i');
	});
</script>

<template>
	<span class="fm-elevation-stats">
		<span>
			<Icon icon="triangle-top" alt="Ascent"></Icon> {{route.ascent}}&#x202F;m / <Icon icon="triangle-bottom" alt="Descent"></Icon> {{route.descent}}&#x202F;m
		</span>

		<span ref="statsButtonContainerRef">
			<button
				type="button"
				class="btn btn-secondary"
				v-tooltip="'Show elevation statistics'"
				@click="showStatsPopover = !showStatsPopover"
			>
				<Icon icon="circle-info" alt="Show stats"></Icon>
			</button>
		</span>

		<Popover
			:element="statsButtonContainerRef"
			v-model:show="showStatsPopover"
			hideOnOutsideClick
			class="fm-elevation-stats-popover"
		>
			<dl class="row">
				<dt class="col-6">Total ascent</dt>
				<dd class="col-6">{{route.ascent}}&#x202F;m</dd>

				<dt class="col-6">Total descent</dt>
				<dd class="col-6">{{route.descent}}&#x202F;m</dd>

				<template v-for="stat in statsArr" :key="stat.i">
					<dt class="col-6">{{stat.i == 0 ? '0%' : stat.i < 0 ? "≤ "+stat.i+"%" : "≥ "+stat.i+"%"}}</dt>
					<dd class="col-6">{{round(stat.distance, 2)}}&#x202F;km</dd>
				</template>
			</dl>
		</Popover>
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