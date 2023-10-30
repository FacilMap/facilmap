<script lang="ts">
	import { readonly, ref, watch } from "vue";
	import Toolbox from "./toolbox/toolbox.vue";
	import SearchBox from "./search-box/search-box.vue";
	// import Legend from "../legend/legend.vue";
	import LeafletMap from "./leaflet-map/leaflet-map.vue";
	// import Import from "../import/import.vue";
	// import ClickMarker from "../click-marker/click-marker.vue";
	import ClientContext from "./client-context.vue";
	import { WritableContext, provideContext } from "../utils/context";
	import { useMaxBreakpoint } from "../utils/bootstrap";
	import SearchBoxContext from "./search-box/search-box-context.vue";
import { reactiveReadonlyView } from "../utils/vue";

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
		(type: "update:padId", padId: string | undefined): void;
		(type: "update:padName", padName: string | undefined): void;
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
			<LeafletMap>
				<SearchBoxContext>
					<Toolbox v-if="context.toolbox" :interactive="context.interactive"></Toolbox>
					<!--<Legend v-if="context.legend"></Legend>
					<Import v-if="context.interactive"></Import>
					<ClickMarker></ClickMarker>-->

					<template #before>
						<slot name="before"></slot>
					</template>

					<template #after>
						<SearchBox></SearchBox>
						<slot name="after"></slot>
					</template>

					<slot></slot>

					<!--<SearchFormTab v-if="context.search"></SearchFormTab>
					<RouteFormTab v-if="context.search"></RouteFormTab>
					<OverpassFormTab v-if="context.search"></OverpassFormTab>
					<MarkerInfoTab></MarkerInfoTab>
					<LineInfoTab></LineInfoTab>
					<MultipleInfoTab></MultipleInfoTab>
					<OverpassInfoTab></OverpassInfoTab>-->
				</SearchBoxContext>
			</LeafletMap>
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