<script setup lang="ts">
	import { getLayers } from "facilmap-leaflet";
	import { getLegendItems } from "./legend/legend-utils";
	import type { Writable } from "facilmap-types";
	import { quoteHtml, round } from "facilmap-utils";
	import { computed, ref } from "vue";
	import ModalDialog from "./ui/modal-dialog.vue";
	import { getUniqueId } from "../utils/utils";
	import { injectContextRequired, requireClientContext, requireMapContext } from "./facil-map-context-provider/facil-map-context-provider.vue";
	import CopyToClipboardInput from "./ui/copy-to-clipboard-input.vue";

	const context = injectContextRequired();
	const client = requireClientContext(context);
	const mapContext = requireMapContext(context);

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
		const { baseLayers, overlays } = getLayers(mapContext.value.components.map);
		return [
			baseLayers[mapContext.value.layers.baseLayer]?.options.fmName || mapContext.value.layers.baseLayer,
			...mapContext.value.layers.overlays.map((key) => overlays[key].options.fmName || key)
		].join(", ");
	});

	const hasLegend = computed(() => {
		return !!client.value.padData && getLegendItems(context).length > 0;
	});

	const padIdTypes = computed(() => {
		return [
			{ value: 2, text: 'Admin' },
			{ value: 1, text: 'Writable' },
			{ value: 0, text: 'Read-only' }
		].filter((option) => client.value.writable != null && option.value <= client.value.writable);
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
			+ (client.value.padData ? encodeURIComponent((padIdType.value == 2 && client.value.padData.adminId) || (padIdType.value == 1 && client.value.padData.writeId) || client.value.padData.id) : '')
			+ (paramsStr ? `?${paramsStr}` : '')
			+ (includeMapView.value && mapContext.value.hash ? `#${mapContext.value.hash}` : '');
	});

	const embedCode = computed(() => {
		return `<iframe style="height:500px; width:100%; border:none;" src="${quoteHtml(url.value)}"></iframe>`;
	});
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
				<div class="form-check fm-form-check-with-label">
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
				</div>

				<div class="form-check">
					<input
						type="checkbox"
						class="form-check-input"
						:id="`${id}-show-toolbox-input`"
						v-model="showToolbox"
					/>
					<label :for="`${id}-show-toolbox-input`" class="form-check-label">
						Show toolbox
					</label>
				</div>

				<div class="form-check">
					<input
						type="checkbox"
						class="form-check-input"
						:id="`${id}-show-search-input`"
						v-model="showSearch"
					/>
					<label :for="`${id}-show-search-input`" class="form-check-label">
						Show search box
					</label>
				</div>

				<div class="form-check" v-if="hasLegend">
					<input
						type="checkbox"
						class="form-check-input"
						:id="`${id}-show-legend-input`"
						v-model="showLegend"
					/>
					<label :for="`${id}-show-legend-input`" class="form-check-label">
						Show legend
					</label>
				</div>
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
			<CopyToClipboardInput
				class="mt-2"
				:modelValue="url"
				readonly
				successTitle="Map link copied"
				successMessage="The map link was copied to the clipboard."
			></CopyToClipboardInput>
		</template>

		<template v-else-if="activeShareTab === 1">
			<CopyToClipboardInput
				class="mt-2"
				:modelValue="embedCode"
				readonly
				successTitle="Embed code copied"
				:successMessage="`The code to embed ${context.appName} was copied to the clipboard.`"
				:rows="2"
				noQr
			></CopyToClipboardInput>

			<p class="mt-2">Add this HTML code to a web page to embed {{context.appName}}. <a href="https://docs.facilmap.org/developers/embed.html" target="_blank">Learn more</a></p>
		</template>
	</ModalDialog>
</template>