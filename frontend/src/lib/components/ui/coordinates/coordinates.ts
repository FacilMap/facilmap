import WithRender from "./coordinates.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Point } from "facilmap-types";
import "./coordinates.scss";
import copyToClipboard from "copy-to-clipboard";
import { round } from "facilmap-utils";
import Icon from "../icon/icon";

@WithRender
@Component({
	components: { Icon }
})
export default class Coordinates extends Vue {

	@Prop({ type: String }) point!: Point;

	get formattedCoordinates(): string {
		return `${round(this.point.lat, 5)}, ${round(this.point.lon, 5)}`;
	}

	copy(): void {
		copyToClipboard(this.formattedCoordinates);
		this.$bvToast.toast("The coordinates were copied to the clipboard.", { variant: "success", title: "Coordinates copied" });
	}

}