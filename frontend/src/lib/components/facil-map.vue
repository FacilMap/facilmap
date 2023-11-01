<script lang="ts">
	import { readonly, ref, watch } from "vue";
	import Toolbox from "./toolbox/toolbox.vue";
	import SearchBox from "./search-box/search-box.vue";
	import Legend from "./legend/legend.vue";
	import LeafletMap from "./leaflet-map/leaflet-map.vue";
	import ImportTab from "./import-tab.vue";
	import ClickMarkerTab from "./click-marker-tab.vue";
	import ClientContext from "./client-context.vue";
	import { WritableContext, provideContext } from "../utils/context";
	import { useMaxBreakpoint } from "../utils/bootstrap";
	import SearchBoxContext from "./search-box/search-box-context.vue";
	import { reactiveReadonlyView } from "../utils/vue";
	import SearchFormTab from "./search-form/search-form-tab.vue";
	import RouteFormTab from "./route-form/route-form-tab.vue";
	import OverpassFormTab from "./overpass-form/overpass-form-tab.vue";
	import MarkerInfoTab from "./marker-info/marker-info-tab.vue";
	import LineInfoTab from "./line-info/line-info-tab.vue";
	import MultipleInfoTab from "./multiple-info/multiple-info-tab.vue";
	import OverpassInfoTab from "./overpass-info/overpass-info-tab.vue";

	let idCounter = 1;
</script>

<script setup lang="ts">
	const props = withDefaults(defineProps<{
		baseUrl: string;
		serverUrl: string;
		padId: string | undefined;
		toolbox?: boolean;
		search?: boolean;
		autofocus?: boolean;
		legend?: boolean;
		interactive?: boolean;
		linkLogo?: boolean;
		updateHash?: boolean;
	}>(), {
		toolbox: true,
		search: true,
		autofocus: false,
		legend: true,
		interactive: true,
		linkLogo: false,
		updateHash: false
	});

	const emit = defineEmits<{
		"update:padId": [padId: string | undefined];
		"update:padName": [padName: string | undefined];
	}>();

	const isNarrow = useMaxBreakpoint("sm");

	const context = reactiveReadonlyView<WritableContext>(() => ({
		id: idCounter++,
		baseUrl: props.baseUrl,
		toolbox: props.toolbox,
		search: props.search,
		autofocus: props.autofocus,
		legend: props.legend,
		interactive: props.interactive,
		isNarrow: isNarrow.value,
		linkLogo: props.linkLogo,
		updateHash: props.updateHash
	}));

	provideContext(readonly(context));

	const clientRef = ref<InstanceType<typeof ClientContext>>();
	watch(() => clientRef.value?.client?.padId, () => {
		if (clientRef.value?.client && clientRef.value.client.padId !== props.padId) {
			emit("update:padId", clientRef.value.client.padId);
		}
	});

	watch(() => clientRef.value?.client?.padData?.name, () => {
		if (clientRef.value?.client) {
			emit("update:padName", clientRef.value.client.padData?.name);
		}
	});
</script>

<template>
	<div class="fm-facilmap">
		<ClientContext :padId="padId" :serverUrl="serverUrl" ref="clientRef">
			<SearchBoxContext>
				<LeafletMap>
					<Toolbox v-if="context.toolbox" :interactive="context.interactive"></Toolbox>

					<SearchFormTab v-if="context.search"></SearchFormTab>
					<RouteFormTab v-if="context.search"></RouteFormTab>
					<OverpassFormTab v-if="context.search"></OverpassFormTab>
					<MarkerInfoTab></MarkerInfoTab>
					<LineInfoTab></LineInfoTab>
					<MultipleInfoTab></MultipleInfoTab>
					<OverpassInfoTab></OverpassInfoTab>
					<ImportTab v-if="context.interactive"></ImportTab>
					<ClickMarkerTab></ClickMarkerTab>
					<Legend v-if="context.legend"></Legend>

					<template #before>
						<slot name="before"></slot>
					</template>

					<template #after>
						<SearchBox></SearchBox>
						<slot name="after"></slot>
					</template>

					<slot></slot>
				</LeafletMap>
			</SearchBoxContext>
		</ClientContext>
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