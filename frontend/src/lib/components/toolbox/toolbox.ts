import Component from "vue-class-component";
import Vue from "vue";
import WithRender from "./toolbox.vue";
import "./toolbox.scss";
import { Prop } from "vue-property-decorator";
import { Client, InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { displayView, getLayers, setBaseLayer, toggleOverlay } from "facilmap-leaflet";
import { Type, View } from "facilmap-types";
import About from "../about/about";
import Sidebar from "../ui/sidebar/sidebar";
import Icon from "../ui/icon/icon";
import PadSettings from "../pad-settings/pad-settings";
import SaveView from "../save-view/save-view";
import ManageViews from "../manage-views/manage-views";
import { drawLine, drawMarker } from "../../utils/draw";
import ManageTypes from "../manage-types/manage-types";
import EditFilter from "../edit-filter/edit-filter";
import History from "../history/history";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import storage, { Bookmark } from "../../utils/storage";
import ManageBookmarks from "../manage-bookmarks/manage-bookmarks";
import OpenMap from "../open-map/open-map";
import { Context } from "../facilmap/facilmap";
import Share from "../share/share";

@WithRender
@Component({
	components: { About, EditFilter, History, Icon, ManageBookmarks, ManageViews, ManageTypes, OpenMap, PadSettings, SaveView, Share, Sidebar }
})
export default class Toolbox extends Vue {

	@InjectContext() context!: Context;
	@InjectClient() readonly client!: Client;
	@InjectMapComponents() readonly mapComponents!: MapComponents;
	@InjectMapContext() readonly mapContext!: MapContext;
	@Prop({ type: Boolean, default: true }) readonly interactive!: boolean;

	get hash(): string {
		const v = this.mapContext;
		return v.hash && v.hash != "#" ? v.hash : `${v.zoom}/${v.center.lat}/${v.center.lng}`;
	}

	get links(): Record<'osm' | 'google' | 'googleSatellite' | 'bing' | 'facilmap', string> {
		const v = this.mapContext;
		return {
			osm: `https://www.openstreetmap.org/#map=${v.zoom}/${v.center.lat}/${v.center.lng}`,
			google: `https://www.google.com/maps/@?api=1&map_action=map&center=${v.center.lat},${v.center.lng}&zoom=${v.zoom}`,
			googleSatellite: `https://www.google.com/maps/@?api=1&map_action=map&center=${v.center.lat},${v.center.lng}&zoom=${v.zoom}&basemap=satellite`,
			bing: `https://www.bing.com/maps?cp=${v.center.lat}~${v.center.lng}&lvl=${v.zoom}`,
			facilmap: `${this.context.baseUrl}#${this.hash}`
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
		const { baseLayers } = getLayers(this.mapComponents.map);
		return Object.keys(baseLayers).map((key) => ({
			key,
			name: baseLayers[key].options.fmName!,
			active: this.mapContext.layers.baseLayer === key
		}));
	}

	get overlays(): Array<{ key: string; name: string; active: boolean }> {
		const { overlays } = getLayers(this.mapComponents.map);
		return Object.keys(overlays).map((key) => ({
			key,
			name: overlays[key].options.fmName!,
			active: this.mapContext.layers.overlays.includes(key)
		}));
	}

	get bookmarks(): Bookmark[] {
		return storage.bookmarks;
	}

	get isBookmarked(): boolean {
		return !!this.client.padId && storage.bookmarks.some((bookmark) => bookmark.id == this.client.padId);
	}

	addBookmark(): void {
		storage.bookmarks.push({ id: this.client.padId!, padId: this.client.padData!.id, name: this.client.padData!.name });
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
		displayView(this.mapComponents.map, view, { overpassLayer: this.mapComponents.overpassLayer });
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
