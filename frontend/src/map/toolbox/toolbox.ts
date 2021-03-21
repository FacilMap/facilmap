import Component from "vue-class-component";
import Vue from "vue";
import WithRender from "./toolbox.vue";
import "./toolbox.scss";
import { Prop } from "vue-property-decorator";
import Client from "facilmap-client";
import { InjectClient, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { baseLayers, displayView, overlays, setBaseLayer, toggleOverlay } from "facilmap-leaflet";
import { Type, View } from "facilmap-types";
import About from "../about/about";
import Sidebar from "../ui/sidebar/sidebar";
import Icon from "../ui/icon/icon";
import context from "../context";
import PadSettings from "../pad-settings/pad-settings";
import SaveView from "../save-view/save-view";
import ManageViews from "../manage-views/manage-views";
import { drawLine, drawMarker } from "../../utils/draw";
import ManageTypes from "../manage-types/manage-types";
import EditFilter from "../edit-filter/edit-filter";
import History from "../history/history";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";

@WithRender
@Component({
    components: { About, EditFilter, History, Icon, ManageViews, ManageTypes, PadSettings, SaveView, Sidebar }
})
export default class Toolbox extends Vue {

	@InjectClient() readonly client!: Client;
	@InjectMapComponents() readonly mapComponents!: MapComponents;
	@InjectMapContext() readonly mapContext!: MapContext;
	@Prop({ type: Boolean, default: true }) readonly interactive!: boolean;

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

	addObject(type: Type): void {
		if(type.type == "marker")
			this.addMarker(type);
		else if(type.type == "line")
			this.addLine(type);
	}

	addMarker(type: Type): void {
		drawMarker(type, this, this.client, this.mapComponents);
	}

	addLine(type: Type): void {
		drawLine(type, this, this.client, this.mapComponents);
	}

	displayView(view: View): void {
		displayView(this.mapComponents.map, view);
	}

	setBaseLayer(key: string): void {
		setBaseLayer(this.mapComponents.map, key);
	}

	toggleOverlay(key: string): void {
		toggleOverlay(this.mapComponents.map, key);
	}

	importFile(): void {
		this.mapContext.$emit("fm-import-file");
	}

}
