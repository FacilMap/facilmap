<script setup lang="ts">
	import { getLayers } from "facilmap-leaflet";
	import copyToClipboard from "copy-to-clipboard";
	import { getLegendItems } from "./legend/legend-utils";
	import type { Writable } from "facilmap-types";
	import { quoteHtml, round } from "facilmap-utils";
	import { injectMapContextRequired } from "./leaflet-map/leaflet-map.vue";
	import { injectClientRequired } from "./client-context.vue";
	import { injectContextRequired } from "../utils/context";
	import { computed, ref } from "vue";
	import { useToasts } from "./ui/toasts/toasts.vue";
	import ModalDialog from "./ui/modal-dialog.vue";
	import { getUniqueId } from "../utils/utils";

	const context = injectContextRequired();
	const client = injectClientRequired();
	const mapContext = injectMapContextRequired();

	const toasts = useToasts();

	const emit = defineEmits<{
		hidden: [];
	}>();

	const id = getUniqueId("fm-share-dialog");

	const includeMapView = ref(true);
	const showToolbox = ref(true);
	const showSearch = ref(true);
	const showLegend = ref(true);
	const padIdType = ref<Writable>(2);
	const activeShareTab = ref(0);

	const layers = computed(() => {
		const { baseLayers, overlays } = getLayers(mapContext.components.map);
		return [
			baseLayers[mapContext.layers.baseLayer]?.options.fmName || mapContext.layers.baseLayer,
			...mapContext.layers.overlays.map((key) => overlays[key].options.fmName || key)
		].join(", ");
	});

	const hasLegend = computed(() => {
		return !!client.padData && getLegendItems(client, mapContext).length > 0;
	});

	const padIdTypes = computed(() => {
		return [
			{ value: 2, text: 'Admin' },
			{ value: 1, text: 'Writable' },
			{ value: 0, text: 'Read-only' }
		].filter((option) => client.writable != null && option.value <= client.writable);
	});

	const url = computed(() => {
		const params = new URLSearchParams();
		if (!showToolbox.value)
			params.set("toolbox", "false");
		if (!showSearch.value)
			params.set("search", "false");
		if (!showLegend.value)
			params.set("legend", "false");
		const paramsStr = params.toString();

		return context.baseUrl
			+ (client.padData ? encodeURIComponent((padIdType.value == 2 && client.padData.adminId) || (padIdType.value == 1 && client.padData.writeId) || client.padData.id) : '')
			+ (paramsStr ? `?${paramsStr}` : '')
			+ (includeMapView.value && mapContext.hash ? `#${mapContext.hash}` : '');
	});

	const embedCode = computed(() => {
		return `<iframe style="height:500px; width:100%; border:none;" src="${quoteHtml(url.value)}"></iframe>`;
	});

	function copyUrl(): void {
		copyToClipboard(url.value);
		toasts.showToast(undefined, "Map link copied", "The map link was copied to the clipboard.", { variant: "success" });
	}

	function copyEmbedCode(): void {
		copyToClipboard(embedCode.value);
		toasts.showToast(undefined, "Embed code copied", "The code to embed FacilMap was copied to the clipboard.", { variant: "success" });
	}
</script>

<template>
	<ModalDialog
		title="Share"
		size="lg"
		class="fm-share-dialog"
		@hidden="emit('hidden')"
	>
		<div class="row mb-3">
			<label class="col-sm-3 col-form-label">Settings</label>
			<div class="col-sm-9">
				<input
					type="checkbox"
					class="form-check-input"
					:id="`${id}-include-map-view-input`"
					v-model="includeMapView"
					:disabled="!client.padData"
				/>
				<label :for="`${id}-include-map-view-input`" class="form-check-label">
					Include current map view (centre: <code>{{round(mapContext.center.lat, 5)}},{{round(mapContext.center.lng, 5)}}</code>; zoom level: <code>{{mapContext.zoom}}</code>; layer(s): {{layers}}<template v-if="mapContext.overpassIsCustom ? !!mapContext.overpassCustom : mapContext.overpassPresets.length > 0">; POIs: <code v-if="mapContext.overpassIsCustom">{{mapContext.overpassCustom}}</code><template v-else>{{mapContext.overpassPresets.map((p) => p.label).join(', ')}}</template></template><template v-if="mapContext.activeQuery">; active object(s): <template v-if="mapContext.activeQuery.description">{{mapContext.activeQuery.description}}</template><code v-else>{{mapContext.activeQuery.query}}</code></template><template v-if="mapContext.filter">; filter: <code>{{mapContext.filter}}</code></template>)
				</label>

				<input
					type="checkbox"
					class="form-check-input"
					:id="`${id}-show-toolbox-input`"
					v-model="showToolbox"
				/>
				<label :for="`${id}-show-toolbox-input`" class="form-check-label">
					Show toolbox
				</label>

				<input
					type="checkbox"
					class="form-check-input"
					:id="`${id}-show-search-input`"
					v-model="showSearch"
				/>
				<label :for="`${id}-show-search-input`" class="form-check-label">
					Show search box
				</label>

				<input
					type="checkbox"
					class="form-check-input"
					:id="`${id}-show-legend-input`"
					v-model="showLegend"
					v-if="hasLegend"
				/>
				<label :for="`${id}-show-legend-input`" class="form-check-label">
					Show legend
				</label>
			</div>
		</div>

		<template v-if="client.padData">
			<div class="row mb-3">
				<label :for="`${id}-padIdType-input`" class="col-sm-3 col-form-label">Link type</label>
				<div class="col-sm-9">
					<select :id="`${id}-padIdType-input`" class="form-select" v-model="padIdType">
						<option v-for="type in padIdTypes" :key="type.value" :value="type.value">{{type.text}}</option>
					</select>
				</div>
			</div>
		</template>

		<ul class="nav nav-tabs">
			<li class="nav-item">
				<a
					class="nav-link"
					href="javascript:"
					:class="{ active: activeShareTab === 0 }"
					@click="activeShareTab = 0"
				>Share link</a>
			</li>

			<li class="nav-item">
				<a
					class="nav-link"
					href="javascript:"
					:class="{ active: activeShareTab === 1 }"
					@click="activeShareTab = 1"
				>Embed</a>
			</li>
		</ul>

		<template v-if="activeShareTab === 0">
			<div class="input-group mt-2">
				<input class="form-control" :value="url" readonly />
				<button type="button" class="btn btn-secondary" @click="copyUrl()">Copy</button>
			</div>
			<p class="mt-2">Share this link with others to allow them to open your map. <a href="https://docs.facilmap.org/users/share/" target="_blank">Learn more</a></p>
		</template>

		<template v-else-if="activeShareTab === 1">
			<div class="input-group mt-2">
				<textarea class="form-control" :value="embedCode" readonly></textarea>
				<button type="button" class="btn btn-secondary" @click="copyEmbedCode()">Copy</button>
			</div>
			<p class="mt-2">Add this HTML code to a web page to embed FacilMap. <a href="https://docs.facilmap.org/developers/embed.html" target="_blank">Learn more</a></p>
		</template>
	</ModalDialog>
</template>