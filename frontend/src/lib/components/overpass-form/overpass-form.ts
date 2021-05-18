import WithRender from "./overpass-form.vue";
import Vue from "vue";
import { Component, Watch } from "vue-property-decorator";
import { InjectMapComponents, InjectMapContext } from "../../utils/decorators";
import { getOverpassPreset, OverpassPreset, overpassPresets, validateOverpassQuery } from "facilmap-leaflet";
import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
import "./overpass-form.scss";
import { debounce } from "lodash";

@WithRender
@Component({ })
export default class OverpassForm extends Vue {

	@InjectMapComponents() mapComponents!: MapComponents;
	@InjectMapContext() mapContext!: MapContext;

	activeTab = 0;
	searchTerm = "";
	customQuery = "";
	customQueryValidationState: boolean | null = null;
	customQueryValidationError: string | null = null;
	customQueryAbortController?: AbortController;

	created(): void {
		this.validateCustomQueryDebounced = debounce(this.validateCustomQuery, 500);
	}

	get categories(): (typeof overpassPresets) {
		return overpassPresets.map((cat) => {
			const presets = cat.presets.map((presets) => presets.map((preset) => ({ ...preset, isChecked: this.mapContext.overpassPresets.includes(preset) })));
			return {
				...cat,
				presets,
				checked: presets.flat().filter((preset) => preset.isChecked).length
			}
		});
	}

	get filteredPresets(): OverpassPreset[] {
		if (!this.searchTerm)
			return [];

		const lowerTerm = this.searchTerm.toLowerCase();
		return this.categories.map((cat) => cat.presets).flat().flat().filter((preset) => preset.label.toLowerCase().includes(lowerTerm));
	}

	@Watch("mapContext.overpassCustom", { immediate: true })
	handleCustomQueryChange(customQuery: string): void {
		this.customQuery = customQuery;
	}

	togglePreset(key: string, enable: boolean): void {
		const without = this.mapContext.overpassPresets.filter((p) => p.key != key);
		this.mapComponents.overpassLayer.setQuery([
			...without,
			...(enable ? [getOverpassPreset(key)!] : [])
		]);
	}

	toggleIsCustom(): void {
		if (this.mapContext.overpassIsCustom) {
			this.mapComponents.overpassLayer.setQuery(this.mapContext.overpassPresets);
			if (this.customQueryAbortController)
				this.customQueryAbortController.abort();
		} else {
			this.mapComponents.overpassLayer.setQuery(this.mapContext.overpassCustom);
			this.validateCustomQuery();
		}
	}

	handleCustomQueryInput(): void {
		if (this.customQueryAbortController)
			this.customQueryAbortController.abort();
		this.validateCustomQueryDebounced();
	}

	async validateCustomQuery(): Promise<void> {
		const query = this.customQuery;

		if (!query) {
			this.customQueryValidationState = null;
			this.customQueryValidationError = null;
		} else {
			this.customQueryAbortController = new AbortController();
			const result = await validateOverpassQuery(query, this.customQueryAbortController.signal);
			if (!this.customQueryAbortController.signal.aborted) {
				this.customQueryValidationState = !result;
				this.customQueryValidationError = result ?? null;
			}
		}

		if (this.customQueryValidationState !== false)
			this.mapComponents.overpassLayer.setQuery(query);
	}

	validateCustomQueryDebounced!: () => void;

}