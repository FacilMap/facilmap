import WithRender from "./overpass.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { Client, InjectClient, InjectContext, InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { overpassPresets, validateOverpassQuery } from "facilmap-leaflet";
import FormModal from "../ui/form-modal/form-modal";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import { Context } from "../facilmap/facilmap";
import { extend, ValidationProvider } from "vee-validate";
import "./overpass.scss";
import { isEqual } from "lodash";

extend("customOverpassQuery", async (query: string): Promise<string | true> => {
	return (await validateOverpassQuery(query)) ?? true;
});

@WithRender
@Component({
	components: { FormModal, ValidationProvider }
})
export default class Overpass extends Vue {

	@InjectContext() context!: Context;
	@InjectMapComponents() mapComponents!: MapComponents;
	@InjectMapContext() mapContext!: MapContext;
	@InjectClient() client!: Client;

	@Prop({ type: String, required: true }) id!: string;

	activeTab = 0;

	get categories(): (typeof overpassPresets) {
		return overpassPresets.map((cat) => {
			const presets = cat.presets.map((presets) => presets.map((preset) => ({ ...preset, isChecked: this.selectedPresets.includes(preset.key) })));
			return {
				...cat,
				presets,
				checked: presets.flat().filter((preset) => preset.isChecked).length
			}
		});
	}

	selectedPresets: string[] = [];
	customQuery = "";
	isCustomQueryMode = false;

	get isModified(): boolean {
		if (this.isCustomQueryMode)
			return !!this.customQuery != !!this.mapContext.overpassCustom || this.customQuery != this.mapContext.overpassCustom;
		else
			return !isEqual(new Set(this.selectedPresets), new Set(this.mapContext.overpassPresets.map((preset) => preset.key)));
	}

	initialize(): void {
		this.selectedPresets = this.mapContext.overpassPresets.map((p) => p.key);
		this.customQuery = this.mapContext.overpassCustom || "";
		this.isCustomQueryMode = !!this.mapContext.overpassCustom;
	}

	togglePreset(key: string): void {
		const idx = this.selectedPresets.indexOf(key);
		if (idx == -1)
			this.selectedPresets.push(key);
		else
			this.selectedPresets.splice(idx, 1);
	}

	save(): void {
		if (this.isCustomQueryMode)
			this.mapComponents.overpassLayer.setQuery(this.customQuery || undefined);
		else
			this.mapComponents.overpassLayer.setQuery(overpassPresets.map((cat) => cat.presets).flat().flat().filter((preset) => this.selectedPresets.includes(preset.key)));

		this.$bvModal.hide(this.id);
	}

}