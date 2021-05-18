import WithRender from "./overpass.vue";
import Vue from "vue";
import { Component, Prop } from "vue-property-decorator";
import { InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { OverpassPreset, overpassPresets, validateOverpassQuery } from "facilmap-leaflet";
import FormModal from "../ui/form-modal/form-modal";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
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

	@InjectMapComponents() mapComponents!: MapComponents;
	@InjectMapContext() mapContext!: MapContext;

	@Prop({ type: String, required: true }) id!: string;

	activeTab = 0;
	selectedPresets: string[] = [];
	customQuery = "";
	searchTerm = "";
	isCustomQueryMode = false;

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

	get isModified(): boolean {
		if (this.isCustomQueryMode)
			return (!!this.customQuery || !!this.mapContext.overpassCustom) && this.customQuery != this.mapContext.overpassCustom;
		else
			return !isEqual(new Set(this.selectedPresets), new Set(this.mapContext.overpassPresets.map((preset) => preset.key)));
	}

	get filteredPresets(): OverpassPreset[] {
		if (!this.searchTerm)
			return [];

		const lowerTerm = this.searchTerm.toLowerCase();
		return this.categories.map((cat) => cat.presets).flat().flat().filter((preset) => preset.label.toLowerCase().includes(lowerTerm));
	}

	initialize(): void {
		this.selectedPresets = this.mapContext.overpassPresets.map((p) => p.key);
		this.customQuery = this.mapContext.overpassCustom || "";
		this.isCustomQueryMode = !!this.mapContext.overpassCustom;
	}

	togglePreset(key: string, enable: boolean): void {
		const idx = this.selectedPresets.indexOf(key);
		if (enable && idx == -1)
			this.selectedPresets.push(key);
		else if (!enable && idx != -1)
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