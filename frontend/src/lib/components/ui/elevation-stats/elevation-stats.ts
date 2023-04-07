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