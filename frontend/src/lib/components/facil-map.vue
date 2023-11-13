<script setup lang="ts">
	import { computed, ref, toRef, watch } from "vue";
	import Toolbox from "./toolbox/toolbox.vue";
	import SearchBox from "./search-box/search-box.vue";
	import Legend from "./legend/legend.vue";
	import LeafletMap from "./leaflet-map/leaflet-map.vue";
	import ImportTab from "./import-tab.vue";
	import ClickMarkerTab from "./click-marker-tab.vue";
	import SearchFormTab from "./search-form/search-form-tab.vue";
	import RouteFormTab from "./route-form/route-form-tab.vue";
	import OverpassFormTab from "./overpass-form/overpass-form-tab.vue";
	import MarkerInfoTab from "./marker-info/marker-info-tab.vue";
	import LineInfoTab from "./line-info/line-info-tab.vue";
	import MultipleInfoTab from "./multiple-info/multiple-info-tab.vue";
	import OverpassInfoTab from "./overpass-info/overpass-info-tab.vue";
	import FacilMapContextProvider from "./facil-map-context-provider/facil-map-context-provider.vue";
	import type { FacilMapSettings } from "./facil-map-context-provider/facil-map-context";
	import ClientProvider from "./client-provider.vue";

	const props = defineProps<{
		baseUrl: string;
		serverUrl: string;
		padId: string | undefined;
		settings?: Partial<FacilMapSettings>;
	}>();

	const emit = defineEmits<{
		"update:padId": [padId: string | undefined];
		"update:padName": [padName: string | undefined];
	}>();

	const padId = computed({
		get: () => props.padId,
		set: (padId) => {
			emit("update:padId", padId);
		}
	});

	const contextRef = ref<InstanceType<typeof FacilMapContextProvider>>();
	const context = toRef(() => contextRef.value?.context);
	const client = toRef(() => context.value?.components.client);

	watch(() => client.value?.padId, () => {
		if (client.value && client.value.padId !== props.padId) {
			emit("update:padId", client.value.padId);
		}
	});

	watch(() => client.value?.padData?.name, () => {
		if (client.value) {
			emit("update:padName", client.value.padData?.name);
		}
	});

	defineExpose({
		context
	});
</script>

<template>
	<div class="fm-facilmap">
		<FacilMapContextProvider
			:baseUrl="props.baseUrl"
			:settings="props.settings"
			ref="contextRef"
		>
			<ClientProvider v-model:padId="padId" :serverUrl="serverUrl"></ClientProvider>

			<LeafletMap v-if="context?.components.client">
				<Toolbox v-if="context.settings.toolbox" :interactive="context.settings.interactive"></Toolbox>

				<template v-if="context.components.searchBox">
					<SearchFormTab v-if="context.settings.search"></SearchFormTab>
					<RouteFormTab v-if="context.settings.search"></RouteFormTab>
					<OverpassFormTab v-if="context.settings.search"></OverpassFormTab>
					<MarkerInfoTab></MarkerInfoTab>
					<LineInfoTab></LineInfoTab>
					<MultipleInfoTab></MultipleInfoTab>
					<OverpassInfoTab></OverpassInfoTab>
					<ImportTab v-if="context.settings.interactive"></ImportTab>
					<ClickMarkerTab></ClickMarkerTab>
					<Legend v-if="context.settings.legend"></Legend>
				</template>

				<template #before>
					<slot name="before"></slot>
				</template>

				<template #after>
					<SearchBox></SearchBox>
					<slot name="after"></slot>
				</template>

				<slot></slot>
			</LeafletMap>
		</FacilMapContextProvider>
	</div>
</template>

<style lang="scss">
	.fm-facilmap {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
	}

	.td-buttons {
		white-space: nowrap;
		width: 1px;

		> button {
			margin-left: 0.25rem;
		}
	}

	.fm-drag-handle {
		cursor: grab !important;
	}

	.btn-toolbar {
		> * + * {
			margin-left: 0.25rem;
		}
	}

	.closeable-tab-title {
		display: inline-flex;
		width: 100%;

		> span {
			align-items: center;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			flex-grow: 1;
		}

		a {
			padding: 0 !important;
		}

		object, a, .fm-icon {
			display: inline-flex;
			align-items: center;
		}
	}
</style>