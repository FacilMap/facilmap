import WithRender from "./search-result-info.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { renderOsmTag } from "facilmap-utils";
import { SearchResult, Type } from "facilmap-types";
import Icon from "../ui/icon/icon";
import { InjectClient, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import Client from "facilmap-client";
import "./search-result-info.scss";
import { FileResult } from "../../utils/files";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import { isLineResult, isMarkerResult } from "../../utils/search";

@WithRender
@Component({
	components: { Icon }
})
export default class SearchResultInfo extends Vue {

	@InjectClient() client!: Client;
	@InjectMapComponents() mapComponents!: MapComponents;
	@InjectMapContext() mapContext!: MapContext;

	@Prop({ type: Object, required: true }) result!: SearchResult | FileResult;
	@Prop({ type: Boolean, default: false }) showBackButton!: boolean;

	renderOsmTag = renderOsmTag;

	get isMarker(): boolean {
		return isMarkerResult(this.result);
	}

	get isLine(): boolean {
		return isLineResult(this.result);
	}

	get types(): Type[] {
		// Result can be both marker and line
		return Object.values(this.client.types).filter((type) => (this.isMarker && type.type == "marker") || (this.isLine && type.type == "line"));
	}

}

/* function showResultInfoBox(query, results, result, onClose) {
	var popupScope = $rootScope.$new();

	popupScope.client = map.client;
	popupScope.result = result;

	popupScope.addToMap = function(type) {
		scope.addResultToMap(result, type);
	};

	popupScope.useForRoute = function(mode) {
		map.searchUi.setRouteDestination(query, mode, results, [ ], result);
	};

	let [center, zoom] = getZoomDestination(result);

	currentInfoBox = map.infoBox.show({
		template: require("./result-popup.html"),
		scope: popupScope,
		onCloseStart: () => {
			onClose && onClose();

			currentInfoBox = null;
		},
		onCloseEnd: () => {
			popupScope.$destroy();
		},
		id: result.id,
		center,
		zoom
	});
} */