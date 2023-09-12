<script setup lang="ts">
	import Vue from "vue";
	import { Component, Prop } from "vue-property-decorator";
	import WithRender from "./elevation-stats.vue";
	import { sortBy } from "lodash-es";
	import { LineWithTrackPoints, RouteWithTrackPoints } from "facilmap-client";
	import { createElevationStats } from "../../../utils/heightgraph";
	import Icon from "../icon/icon";
	import "./elevation-stats.scss";
	import { numberKeys } from "facilmap-utils";

	@WithRender
	@Component({
		components: { Icon }
	})
	export default class ElevationStats extends Vue {

		@Prop({ type: Object, required: true }) route!: LineWithTrackPoints | RouteWithTrackPoints;

		id = Date.now();

		get statsArr(): any {
			const stats = createElevationStats(this.route.extraInfo, this.route.trackPoints)
			return stats && sortBy([...numberKeys(stats)].map((i) => ({ i, distance: stats[i] })), 'i');
		}

	}
</script>

<template>
	<span class="fm-elevation-stats">
		<span>
			<Icon icon="triangle-top" alt="Ascent"></Icon> {{route.ascent}} m / <Icon icon="triangle-bottom" alt="Descent"></Icon> {{route.descent}} m
		</span>
		<b-button :id="`fm-elevation-stats-${id}`" v-b-tooltip.hover="'Show elevation statistics'"><Icon icon="circle-info" alt="Show stats"></Icon></b-button>
		<b-popover :target="`fm-elevation-stats-${id}`" placement="bottom" triggers="click blur" custom-class="fm-elevation-stats-popover">
			<dl class="row">
				<dt class="col-6">Total ascent</dt>
				<dd class="col-6">{{route.ascent}} m</dd>

				<dt class="col-6">Total descent</dt>
				<dd class="col-6">{{route.descent}} m</dd>

				<template v-for="stat in statsArr">
					<dt class="col-6">{{stat.i == 0 ? '0%' : stat.i < 0 ? "≤ "+stat.i+"%" : "≥ "+stat.i+"%"}}</dt>
					<dd class="col-6">{{stat.distance | round(2)}} km</dd>
				</template>
			</dl>
		</b-popover>
	</span>
</template>

<style lang="scss">
	.fm-elevation-stats {
		display: inline-flex;
		align-items: center;

		button {
			margin-left: 0.5rem;
			padding: 0 0.25rem;
			line-height: 1;
		}
	}
</style>