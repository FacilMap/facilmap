<script setup lang="ts">
	import { getOverpassPreset, overpassPresets, validateOverpassQuery } from "facilmap-leaflet";
	import { computed, ref, watch } from "vue";
	import { injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import ValidatedField from "../ui/validated-form/validated-field.vue";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);

	const activeTab = ref(0);
	const searchTerm = ref("");
	const customQuery = ref("");

	const categories = computed(() => {
		return overpassPresets.map((cat) => {
			const presets = cat.presets.map((presets) => presets.map((preset) => ({
				...preset,
				isChecked: mapContext.value.overpassPresets.some((p) => p.key === preset.key)
			})));
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

	watch(() => mapContext.value.overpassCustom, () => {
		customQuery.value = mapContext.value.overpassCustom;
	}, { immediate: true });

	function togglePreset(key: string, enable: boolean): void {
		const without = mapContext.value.overpassPresets.filter((p) => p.key != key);
		mapContext.value.components.overpassLayer.setQuery([
			...without,
			...(enable ? [getOverpassPreset(key)!] : [])
		]);
	}

	function toggleIsCustom(): void {
		if (mapContext.value.overpassIsCustom) {
			mapContext.value.components.overpassLayer.setQuery(mapContext.value.overpassPresets);
		} else {
			mapContext.value.components.overpassLayer.setQuery(mapContext.value.overpassCustom);
		}
	}

	async function validateCustomQuery(query: string, signal: AbortSignal): Promise<string | undefined> {
		if (query) {
			const result = await validateOverpassQuery(query, signal);
			if (result) {
				return result;
			}
		}
		if (!signal.aborted) {
			mapContext.value.components.overpassLayer.setQuery(query);
		}
	}
</script>

<template>
	<div class="fm-overpass-form">
		<template v-if="!mapContext.overpassIsCustom">
			<input
				class="form-control fm-autofocus"
				type="search"
				v-model="searchTerm"
				placeholder="Filter…"
			/>
			<hr />

			<template v-if="searchTerm">
				<div class="checkbox-grid fm-search-box-collapse-point">
					<template v-for="preset in filteredPresets" :key="preset.key">
						<div class="form-check">
							<input
								type="checkbox"
								class="form-check-input"
								:id="`fm${context.id}-overpass-form-preset-${preset.key}`"
								:checked="preset.isChecked"
								@change="togglePreset(preset.key, ($event.target as HTMLInputElement).checked)"
							/>
							<label :for="`fm${context.id}-overpass-form-preset-${preset.key}`" class="form-check-label">
								{{preset.label}}
							</label>
						</div>
					</template>
				</div>
			</template>

			<template v-else>
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
									:class="activeTab == idx ? 'text-bg-secondary' : 'text-bg-primary'"
								>{{category.checked}}</span>
							</a>
						</li>
					</template>
				</ul>

				<hr />

				<div class="fm-search-box-collapse-point">
					<template v-for="(presets, idx) in categories[activeTab].presets" :key="idx">
						<hr v-if="idx > 0" />
						<div class="checkbox-grid">
							<template v-for="preset in presets" :key="preset.key">
								<div class="form-check">
									<input
										type="checkbox"
										class="form-check-input"
										:id="`fm${context.id}-overpass-form-preset-${preset.key}`"
										:checked="preset.isChecked"
										@change="togglePreset(preset.key, ($event.target as HTMLInputElement).checked)"
									/>
									<label :for="`fm${context.id}-overpass-form-preset-${preset.key}`" class="form-check-label">
										{{preset.label}}
									</label>
								</div>
							</template>
						</div>
					</template>
				</div>
			</template>
		</template>
		<template v-else>
			<ValidatedField
				tag="form"
				action="javascript:"
				:value="customQuery"
				:validators="[validateCustomQuery]"
				:reportValid="!!customQuery"
				immediate
				:debounceMs="500"
			>
				<template #default="slotProps">
					<textarea
						v-model="customQuery"
						rows="5"
						class="form-control text-monospace"
						:ref="slotProps.inputRef"
					></textarea>
					<div class="invalid-feedback" v-if="slotProps.validationError">
						<pre>{{slotProps.validationError}}</pre>
					</div>
				</template>
			</ValidatedField>

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

		<div class="btn-toolbar">
			<button
				type="button"
				class="btn btn-secondary"
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
		min-height: 0;

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

		.nav-link {
			display: flex;
			gap: 5px;
			align-items: center;
		}

		.fm-search-box-collapse-point {
			min-height: 1.5em;
		}
	}
</style>