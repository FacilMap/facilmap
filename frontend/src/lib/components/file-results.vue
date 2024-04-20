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
	import { useI18n } from "../utils/i18n";

	type ViewImport = FileResultObject["views"][0];
	type TypeImport = FileResultObject["types"][0];

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const client = requireClientContext(context);
	const toasts = useToasts();
	const i18n = useI18n();

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
			toasts.showErrorToast(`fm${context.id}-file-result-import-error`, () => i18n.t("file-results.import-view-error"), err);
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
			toasts.showErrorToast(`fm${context.id}-file-result-import-error`, () => i18n.t("file-results.import-type-error"), err);
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
					<h3>{{i18n.t("file-results.views")}}</h3>
					<ul class="list-group">
						<!-- eslint-disable-next-line vue/require-v-for-key -->
						<li v-for="view in file.views" class="list-group-item">
							<span class="text-break">
								<a href="javascript:" @click="showView(view)">{{view.name}}</a>
								{{" "}}
								<span class="result-type">({{i18n.t("file-results.view")}})</span>
							</span>
							<template v-if="isAddingView.has(view)">
								<div class="spinner-border spinner-border-sm"></div>
							</template>
							<template v-else-if="client.mapData && client.writable == 2 && !existingViews.get(view)">
								<a
									href="javascript:"
									@click="addView(view)"
									v-tooltip.right="i18n.t('file-results.add-view-tooltip')"
								>
									<Icon icon="plus" :alt="i18n.t('file-results.add-view-alt')"></Icon>
								</a>
							</template>
						</li>
					</ul>
				</template>
				<h3 v-if="hasViews || hasTypes">{{i18n.t("file-results.markers-lines")}}</h3>
			</template>

			<template #after>
				<template v-if="hasTypes">
					<h3>{{i18n.t("file-results.types")}}</h3>
					<ul class="list-group">
						<!-- eslint-disable-next-line vue/require-v-for-key -->
						<li v-for="type in file.types" class="list-group-item">
							<span class="text-break">
								{{type.name}}
								{{" "}}
								<span class="result-type">({{i18n.t("file-results.type")}})</span>
							</span>
							<template v-if="isAddingType.has(type)">
								<div class="spinner-border spinner-border-sm"></div>
							</template>
							<template v-else-if="client.mapData && client.writable == 2 && !existingTypes.get(type)">
								<a
									href="javascript:"
									@click="addType(type)"
									v-tooltip.right="i18n.t('file-results.add-type-tooltip')"
								>
									<Icon icon="plus" :alt="i18n.t('file-results.add-type-alt')"></Icon>
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