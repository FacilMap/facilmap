import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import WithRender from "./elevation-stats.vue";
import { sortBy } from "lodash";
import { LineWithTrackPoints, RouteWithTrackPoints } from "facilmap-client";
import { createElevationStats } from "../../../utils/heightgraph";
import Icon from "../icon/icon";
import "./elevation-stats.scss";

@WithRender
@Component({
	components: { Icon }
})
export default class ElevationStats extends Vue {
	
	@Prop({ type: Object, required: true }) route!: LineWithTrackPoints | RouteWithTrackPoints;

	id = Date.now();

	get statsArr(): any {
		const stats = createElevationStats(this.route.extraInfo, this.route.trackPoints)
		return stats && sortBy((Object.keys(stats) as any as number[]).map((i) => ({ i: Number(i), distance: stats[i] })), 'i');
	}

}