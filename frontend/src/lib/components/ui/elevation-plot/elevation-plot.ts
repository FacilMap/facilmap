import WithRender from "./elevation-plot.vue";
import Vue from "vue";
import { Component, Prop, Ref, Watch } from "vue-property-decorator";
import { InjectMapComponents, InjectSearchBoxContext } from "../../../utils/decorators";
import { MapComponents } from "../../leaflet-map/leaflet-map";
import FmHeightgraph from "../../../utils/heightgraph";
import { LineWithTrackPoints, RouteWithTrackPoints } from "facilmap-client";
import $ from "jquery";
import "./elevation-plot.scss";
import { SearchBoxContext } from "../../search-box/search-box";

@WithRender
@Component({})
export default class ElevationPlot extends Vue {

	@InjectMapComponents() mapComponents!: MapComponents;
	@InjectSearchBoxContext() searchBoxContext?: SearchBoxContext;

	@Ref() container!: HTMLElement;

	@Prop({ type: Object, required: true }) route!: RouteWithTrackPoints | LineWithTrackPoints;

	elevationPlot!: FmHeightgraph;

	mounted(): void {
		this.elevationPlot = new FmHeightgraph();
		this.elevationPlot._map = this.mapComponents.map;

		this.handleTrackPointsChange();

		this.container.append(this.elevationPlot.onAdd(this.mapComponents.map));
		this.handleResize();

		if (this.searchBoxContext) {
			this.searchBoxContext.$on("resizeend", this.handleResize);
			this.searchBoxContext.$on("resizereset", this.handleResize);
		}

		$(window).on("resize", this.handleResize);
	}


	beforeDestroy(): void {
		if (this.searchBoxContext) {
			this.searchBoxContext.$off("resizeend", this.handleResize);
			this.searchBoxContext.$off("resizereset", this.handleResize);
		}

		$(window).off("resize", this.handleResize);
		this.elevationPlot.onRemove(this.mapComponents.map);
	}


	@Watch("route.trackPoints")
	handleTrackPointsChange(): void {
		if(this.route.trackPoints)
			this.elevationPlot.addData(this.route.extraInfo, this.route.trackPoints);
	}


	handleResize(): void {
		this.elevationPlot.resize({ width: this.container.offsetWidth, height: this.container.offsetHeight });
	}

}