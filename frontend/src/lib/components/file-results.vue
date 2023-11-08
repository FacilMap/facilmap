<script setup lang="ts">
	import type { FileResultObject } from "../utils/files";
	import Icon from "./ui/icon.vue";
	import SearchResults from "./search-results/search-results.vue";
	import { displayView } from "facilmap-leaflet";
	import { typeExists, viewExists } from "../utils/search";
	import vTooltip from "../utils/tooltip";
	import { computed, ref } from "vue";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import { injectContextRequired, requireClientContext, requireMapContext } from "./facil-map-context-provider/facil-map-context-provider.vue";

	type ViewImport = FileResultObject["views"][0];
	type TypeImport = FileResultObject["types"][0];

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const client = requireClientContext(context);
	const toasts = useToasts();

	const props = withDefaults(defineProps<{
		layerId: number;
		file: FileResultObject;
		/** When clicking a search result, union zoom to it. Normal zoom is done when clicking the zoom button. */
		unionZoom?: boolean;
		/** When clicking or selecting a search result, zoom to it. */
		autoZoom?: boolean;
	}>(), {
		unionZoom: false,
		autoZoom: false
	});

	const isAddingView = ref(new Set<ViewImport>());
	const isAddingType = ref(new Set<TypeImport>());

	const hasViews = computed(() => props.file.views.length > 0);

	const hasTypes = computed(() => Object.keys(props.file.types).length > 0);

	const existingViews = computed(() => {
		return new Map(props.file.views.map((view) => [view, viewExists(client.value, view)]));
	});

	function showView(view: ViewImport): void {
		displayView(mapContext.value.components.map, view, { overpassLayer: mapContext.value.components.overpassLayer });
	}

	async function addView(view: ViewImport): Promise<void> {
		toasts.hideToast(`fm${context.id}-file-result-import-error`);
		isAddingView.value.add(view);

		try {
			await client.value.addView(view);
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-file-result-import-error`, "Error importing view", err);
		} finally {
			isAddingView.value.delete(view);
		}
	};

	const existingTypes = computed(() => {
		return new Map(Object.values(props.file.types).map((type) => [type, typeExists(client.value, type)]));
	});

	async function addType(type: TypeImport): Promise<void> {
		toasts.hideToast(`fm${context.id}-file-result-import-error`);
		isAddingType.value.add(type);

		try {
			await client.value.addType(type);
		} catch (err) {
			toasts.showErrorToast(`fm${context.id}-file-result-import-error`, "Error importing type", err);
		} finally {
			isAddingType.value.delete(type);
		}
	};
</script>

<template>
	<div class="fm-file-results">
		<SearchResults
			:search-results="file.features"
			:layer-id="layerId"
			:auto-zoom="autoZoom"
			:union-zoom="unionZoom"
			:custom-types="file.types"
		>
			<template #before>
				<template v-if="hasViews">
					<h3>Views</h3>
					<ul class="list-group">
						<!-- eslint-disable-next-line vue/require-v-for-key -->
						<li v-for="view in file.views" class="list-group-item">
							<span>
								<a href="javascript:" @click="showView(view)">{{view.name}}</a>
								{{" "}}
								<span class="result-type">(View)</span>
							</span>
							<template v-if="isAddingView.has(view)">
								<div class="spinner-border spinner-border-sm"></div>
							</template>
							<template v-else-if="client.padData && client.writable == 2 && !existingViews.get(view)">
								<a
									href="javascript:"
									@click="addView(view)"
									v-tooltip.right="'Add this view to the map'"
								>
									<Icon icon="plus" alt="Add"></Icon>
								</a>
							</template>
						</li>
					</ul>
				</template>
				<h3 v-if="hasViews || hasTypes">Markers/Lines</h3>
			</template>

			<template #after>
				<template v-if="hasTypes">
					<h3>Types</h3>
					<ul class="list-group">
						<!-- eslint-disable-next-line vue/require-v-for-key -->
						<li v-for="type in file.types" class="list-group-item">
							<span>
								{{type.name}}
								{{" "}}
								<span class="result-type">(Type)</span>
							</span>
							<template v-if="isAddingType.has(type)">
								<div class="spinner-border spinner-border-sm"></div>
							</template>
							<template v-else-if="client.padData && client.writable == 2 && !existingTypes.get(type)">
								<a
									href="javascript:"
									@click="addType(type)"
									v-tooltip.right="'Add this type to the map'"
								>
									<Icon icon="plus" alt="Add"></Icon>
								</a>
							</template>
						</li>
					</ul>
				</template>
			</template>

		</SearchResults>
	</div>
</template>

<style lang="scss">
	.fm-file-results {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
</style>