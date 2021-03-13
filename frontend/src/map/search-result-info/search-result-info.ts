import WithRender from "./search-result-info.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { renderOsmTag } from "facilmap-utils";
import { SearchResult } from "facilmap-types";
import Icon from "../ui/icon/icon";

@WithRender
@Component({
	components: { Icon }
})
export default class SearchResultInfo extends Vue {

	@Prop({ type: Object, required: true }) result!: SearchResult;
	@Prop({ type: Boolean, default: false }) showBackButton!: boolean;

	renderOsmTag = renderOsmTag;

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