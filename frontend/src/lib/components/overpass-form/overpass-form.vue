<script setup lang="ts">
	import WithRender from "./overpass-form.vue";
	import Vue from "vue";
	import { Component, Watch } from "vue-property-decorator";
	import { InjectMapComponents, InjectMapContext } from "../../utils/decorators";
	import { getOverpassPreset, OverpassPreset, overpassPresets, validateOverpassQuery } from "facilmap-leaflet";
	import { MapComponents, MapContext } from "../leaflet-map/leaflet-map";
	import "./overpass-form.scss";
	import { debounce } from "lodash-es";

	@WithRender
	@Component({ })
	export default class OverpassForm extends Vue {

		const mapComponents = injectMapComponentsRequired();
		const mapContext = injectMapContextRequired();

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
				const abortController = new AbortController();
				this.customQueryAbortController = abortController;
				const result = await validateOverpassQuery(query, this.customQueryAbortController.signal);
				if (!abortController.signal.aborted) {
					this.customQueryValidationState = !result;
					this.customQueryValidationError = result ?? null;
				} else
					return;
			}

			if (this.customQueryValidationState !== false)
				this.mapComponents.overpassLayer.setQuery(query);
		}

		validateCustomQueryDebounced!: () => void;

	}
</script>

<template>
	<div class="fm-overpass-form">
		<template v-if="!mapContext.overpassIsCustom">
			<b-form-input type="search" v-model="searchTerm" placeholder="Filter…" autofocus></b-form-input>
			<hr />

			<div v-if="searchTerm" class="checkbox-grid">
				<b-form-checkbox
					v-for="preset in filteredPresets"
					:checked="preset.isChecked"
					@input="togglePreset(preset.key, $event)"
				>{{preset.label}}</b-form-checkbox>
			</div>

			<b-tabs v-else pills lazy v-model="activeTab">
				<b-tab v-for="(category, idx) in categories" :title="category.label">
					<template #title>
						{{category.label}}
						<b-badge v-if="category.checked > 0" :variant="activeTab == idx ? 'secondary' : 'primary'">{{category.checked}}</b-badge>
					</template>
					<template v-for="presets in category.presets">
						<hr />
						<div class="checkbox-grid">
							<b-form-checkbox
								v-for="preset in presets"
								:checked="preset.isChecked"
								@input="togglePreset(preset.key, $event)"
							>{{preset.label}}</b-form-checkbox>
						</div>
					</template>
				</b-tab>
			</b-tabs>
		</template>
		<template v-else>
			<b-form-group :state="customQueryValidationState">
				<b-textarea v-model="customQuery" rows="5" :state="customQueryValidationState" class="text-monospace" @input="handleCustomQueryInput"></b-textarea>
				<template #invalid-feedback><pre>{{customQueryValidationError}}</pre></template>
			</b-form-group>

			<hr />

			<p>
				Enter an <a href="https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL#The_Query_Statement" target="_blank">Overpass query statement</a>
				here. Settings and an <code>out</code> statement are added automatically in the background. For ways and relations, a marker will be shown at
				the geometric centre, no lines or polygons are drawn.
			</p>
			<p>
				Example queries are <code>nwr[amenity=parking]</code> to get parking places or
				<code>(nwr[amenity=atm];nwr[amenity=bank][atm][atm!=no];)</code> for ATMs.
			</p>
		</template>

		<hr />

		<b-button-toolbar>
			<b-button
				@click="toggleIsCustom()"
				:pressed="mapContext.overpassIsCustom"
			>Custom query</b-button>
		</b-button-toolbar>
	</div>
</template>

<style lang="scss">
	.fm-overpass-form {
		display: flex;
		flex-direction: column;

		.checkbox-grid {
			column-width: 160px;
			padding: 0 .25rem;
		}

		pre {
			color: inherit;
			font-size: inherit;
		}

		fieldset + hr, p + hr {
			margin-top: 0;
		}
	}
</style>