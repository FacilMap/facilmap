<script setup lang="ts">
	import { getOverpassPreset, overpassPresets, validateOverpassQuery } from "facilmap-leaflet";
	import { debounce } from "lodash-es";
	import { computed, ref, watch } from "vue";
	import { injectMapContextRequired } from "../leaflet-map/leaflet-map.vue";
	import { injectContextRequired } from "../../utils/context";

	const context = injectContextRequired();
	const mapContext = injectMapContextRequired();

	const activeTab = ref(0);
	const searchTerm = ref("");
	const customQuery = ref("");
	const customQueryValidationState = ref<boolean>();
	const customQueryValidationError = ref<string>();
	const customQueryAbortController = ref<AbortController>();

	const validateCustomQueryDebounced = debounce(validateCustomQuery, 500);

	const categories = computed(() => {
		return overpassPresets.map((cat) => {
			const presets = cat.presets.map((presets) => presets.map((preset) => ({ ...preset, isChecked: mapContext.overpassPresets.includes(preset) })));
			return {
				...cat,
				presets,
				checked: presets.flat().filter((preset) => preset.isChecked).length
			}
		});
	});

	const filteredPresets = computed(() => {
		if (!searchTerm.value)
			return [];

		const lowerTerm = searchTerm.value.toLowerCase();
		return categories.value.map((cat) => cat.presets).flat().flat().filter((preset) => preset.label.toLowerCase().includes(lowerTerm));
	});

	watch(() => mapContext.overpassCustom, () => {
		customQuery.value = mapContext.overpassCustom;
	}, { immediate: true });

	function togglePreset(key: string, enable: boolean): void {
		const without = mapContext.overpassPresets.filter((p) => p.key != key);
		mapContext.components.overpassLayer.setQuery([
			...without,
			...(enable ? [getOverpassPreset(key)!] : [])
		]);
	}

	function  toggleIsCustom(): void {
		if (mapContext.overpassIsCustom) {
			mapContext.components.overpassLayer.setQuery(mapContext.overpassPresets);
			if (customQueryAbortController.value)
				customQueryAbortController.value.abort();
		} else {
			mapContext.components.overpassLayer.setQuery(mapContext.overpassCustom);
			validateCustomQuery();
		}
	}

	function handleCustomQueryInput(): void {
		if (customQueryAbortController.value)
			customQueryAbortController.value.abort();
		validateCustomQueryDebounced();
	}

	async function validateCustomQuery(): Promise<void> {
		const query = customQuery.value;

		if (!query) {
			customQueryValidationState.value = undefined;
			customQueryValidationError.value = undefined;
		} else {
			const abortController = new AbortController();
			customQueryAbortController.value = abortController;
			const result = await validateOverpassQuery(query, customQueryAbortController.value.signal);
			if (!abortController.signal.aborted) {
				customQueryValidationState.value = !result;
				customQueryValidationError.value = result;
			} else
				return;
		}

		if (customQueryValidationState.value !== false)
			mapContext.components.overpassLayer.setQuery(query);
	}
</script>

<template>
	<div class="fm-overpass-form">
		<template v-if="!mapContext.overpassIsCustom">
			<input class="form-control" type="search" v-model="searchTerm" placeholder="Filter…" autofocus />
			<hr />

			<div v-if="searchTerm" class="checkbox-grid">
				<template v-for="preset in filteredPresets" :key="preset.key">
					<input
						type="checkbox"
						class="form-check-input"
						:id="`fm${context.id}-overpass-form-preset-${preset.key}`"
						:checked="preset.isChecked"
						@update="togglePreset(preset.key, $event)"
					/>
					<label :for="`fm${context.id}-overpass-form-preset-${preset.key}`" class="form-check-label">
						{{preset.label}}
					</label>
				</template>
			</div>

			<ul class="nav nav-pills">
				<template v-for="(category, idx) in categories" :key="idx">
					<li class="nav-item">
						<a
							href="javascript:"
							class="nav-link"
							:class="{ active: activeTab === idx }"
							@click="activeTab = idx"
						>
							{{category.label}}
							<span
								v-if="category.checked > 0"
								class="badge"
								:class="activeTab == idx ? 'bg-secondary' : 'bg-primary'"
							>{{category.checked}}</span>
						</a>
					</li>
				</template>
			</ul>

			<template v-for="(presets, idx) in categories[activeTab].presets" :key="idx">
				<hr />
				<div class="checkbox-grid">
					<template v-for="preset in presets" :key="preset.key">
						<input
							type="checkbox"
							class="form-check-input"
							:id="`fm${context.id}-overpass-form-preset-${preset.key}`"
							:checked="preset.isChecked"
							@update="togglePreset(preset.key, $event)"
						/>
						<label :for="`fm${context.id}-overpass-form-preset-${preset.key}`" class="form-check-label">
							{{preset.label}}
						</label>
					</template>
				</div>
			</template>
		</template>
		<template v-else>
			<textarea v-model="customQuery" rows="5" :state="customQueryValidationState" class="form-control text-monospace" @input="handleCustomQueryInput"></textarea>
			<div class="invalid-feedback" v-if="customQueryValidationError"><pre>{{customQueryValidationError}}</pre></div>

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

		<div class="btn-group">
			<button
				type="button"
				class="btn btn-light"
				:class="{ active: mapContext.overpassIsCustom }"
				@click="toggleIsCustom()"
			>Custom query</button>
		</div>
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