<script setup lang="ts">
	import { getAllOverpassPresets, getOverpassPreset, validateOverpassQuery } from "facilmap-leaflet";
	import { computed, ref, watch } from "vue";
	import { injectContextRequired, requireMapContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import ValidatedField from "../ui/validated-form/validated-field.vue";
	import { T, useI18n } from "../../utils/i18n";
	import { sortBy } from "lodash-es";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const i18n = useI18n();

	const activeTab = ref(0);
	const searchTerm = ref("");
	const customQuery = ref("");

	const categories = computed(() => {
		return getAllOverpassPresets().map((cat) => {
			const presets = cat.presets.map((presets) => sortBy(presets.map((preset) => ({
				...preset,
				isChecked: mapContext.value.overpassPresets.some((p) => p.key === preset.key)
			})), (preset) => preset.label.toLowerCase()));
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
				:placeholder="i18n.t('overpass-form.filter')"
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
				<T k="overpass-form.custom-explanation-1">
					<template #statement>
						<a :href="i18n.t('overpass-form.custom-explanation-1-interpolation-statement-url')" target="_blank" rel="noopener">
							{{i18n.t("overpass-form.custom-explanation-1-interpolation-statement")}}
						</a>
					</template>
					<template #out>
						<code>out</code>
					</template>
				</T>
			</p>
			<p>
				<T k="overpass-form.custom-explanation-2">
					<template #parking>
						<code>nwr[amenity=parking]</code>
					</template>
					<template #atm>
						<code>(nwr[amenity=atm];nwr[amenity=bank][atm][atm!=no];)</code>
					</template>
				</T>
			</p>
		</template>

		<hr />

		<div class="btn-toolbar">
			<button
				type="button"
				class="btn btn-secondary"
				:class="{ active: mapContext.overpassIsCustom }"
				@click="toggleIsCustom()"
			>{{i18n.t("overpass-form.custom-query")}}</button>
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