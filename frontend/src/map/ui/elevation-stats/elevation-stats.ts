import { Line, Route } from "facilmap-types";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import WithRender from "./elevation-stats.vue";
import { sortBy } from "lodash";

@WithRender
@Component({})
export default class ElevationStats extends Vue {
	
	@Prop({ type: Object, required: true }) route!: Line | Route;
	@Prop({ type: Object }) stats: any;

	id = Date.now();

	get statsArr(): any {
		return this.stats && sortBy(Object.keys(this.stats).map((i) => ({ i: Number(i), distance: this.stats[i] })), 'i');
	}

}