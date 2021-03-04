import Component from "vue-class-component";
import Vue from "vue";
import WithRender from "./toolbox.vue";
import "./toolbox.scss";
import { Prop } from "vue-property-decorator";
import Client from "facilmap-client";
import { InjectClient } from "../client/client";
import { InjectMapComponents, InjectMapContext, MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import { baseLayers, displayView, overlays, setBaseLayer, toggleOverlay } from "facilmap-leaflet";
import { View } from "facilmap-types";
import About from "../about/about";
import Sidebar from "../ui/sidebar/sidebar";
import Icon from "../ui/icon/icon";
import context from "../context";
import PadSettings from "../pad/pad-settings";

@WithRender
@Component({
    components: { About, Icon, PadSettings, Sidebar }
})
export default class Toolbox extends Vue {

	@InjectClient() readonly client!: Client;
	@InjectMapComponents() readonly mapComponents!: MapComponents;
	@InjectMapContext() readonly mapContext!: MapContext;
	@Prop({ type: Boolean, default: true }) readonly interactive!: boolean;

	hasImportUi = true; // TODO

	get isNarrow(): boolean {
		return context.isNarrow;
	}

	get links(): Record<'osm' | 'google' | 'bing' | 'facilmap', string> {
		const v = this.mapContext;
		return {
			osm: `https://www.openstreetmap.org/#map=${v.zoom}/${v.center.lat}/${v.center.lng}`,
			google: `https://www.google.com/maps/@${v.center.lat},${v.center.lng},${v.zoom}z`,
			bing: `https://www.bing.com/maps?cp=${v.center.lat}~${v.center.lng}&lvl=${v.zoom}`,
			facilmap: `/#${v.hash && v.hash != "#" ? v.hash : `${v.zoom}/${v.center.lat}/${v.center.lng}`}`
		};
	}

	get filterQuery(): Record<'q' | 'a', string> {
		const v = this.mapContext;
		if (v.filter) {
			return {
				q: `?filter=${encodeURIComponent(v.filter)}`,
				a: `&filter=${encodeURIComponent(v.filter)}`
			};
		} else {
			return { q: "", a: "" };
		}
	}

	get baseLayers(): Array<{ key: string; name: string; active: boolean }> {
		return Object.keys(baseLayers).map((key) => ({
			key,
			name: baseLayers[key].options.fmName!,
			active: this.mapContext.layers.baseLayer === key
		}));
	}

	get overlays(): Array<{ key: string; name: string; active: boolean }> {
		return Object.keys(overlays).map((key) => ({
			key,
			name: overlays[key].options.fmName!,
			active: this.mapContext.layers.overlays.includes(key)
		}));
	}

	/* addObject(type: Type) {
		if(type.type == "marker")
			map.markersUi.addMarker(type);
		else if(type.type == "line")
			map.linesUi.addLine(type);
	} */

	displayView(view: View): void {
		displayView(this.mapComponents.map, view);
	}

	setBaseLayer(key: string): void {
		setBaseLayer(this.mapComponents.map, key);
	}

	toggleOverlay(key: string): void {
		toggleOverlay(this.mapComponents.map, key);
	}

	/* saveView() {
		saveView();
	}

	manageViews() {
		manageViews();
	}

	editObjectTypes() {
		map.typesUi.editTypes();
	}

	scope.$watch(() => !!map.importUi, (hasImportUi) => {
		scope.hasImportUi = hasImportUi;
	});

	importFile() {
		map.importUi.openImportDialog();
	}

	showAbout() {
		fmAbout.showAbout(map);
	}

	filter() {
		fmFilter.showFilterDialog(map.client.filterExpr, map.client.types).then(function(newFilter) {
			map.client.setFilter(newFilter);
		});
	}

	showHistory() {
		map.historyUi.openHistoryDialog();
	} */

}
