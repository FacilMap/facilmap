<script lang="ts">
	import { reactive, watch, watchEffect } from "vue";
	import Toolbox from "../toolbox/toolbox.vue";
	// import SearchBox from "../search-box/search-box.vue";
	// import Legend from "../legend/legend.vue";
	import LeafletMap from "../leaflet-map/leaflet-map.vue";
	// import Import from "../import/import.vue";
	// import ClickMarker from "../click-marker/click-marker.vue";
	import Client from "../client.vue";
	import { Context, provideContext } from "../../utils/context";
import { computedOnResize } from "../../utils/vue";

	let idCounter = 1;
</script>

<script setup lang="ts">
	const props = withDefaults(defineProps<{
		baseUrl: string;
		serverUrl: string;
		padId?: string;
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

	const context = reactive<Context>({
		id: idCounter++,
		baseUrl: "",
		serverUrl: "",
		activePadId: undefined,
		activePadName: undefined,
		toolbox: false,
		search: false,
		autofocus: false,
		legend: false,
		interactive: false,
		isNarrow: false,
		linkLogo: false,
		updateHash: false
	});

	provideContext(context);

	watchEffect(() => {
		context.baseUrl = props.baseUrl;
	});

	watchEffect(() => {
		context.serverUrl = props.serverUrl;
	});

	watchEffect(() => {
		context.activePadId = props.padId;
	});

	watchEffect(() => {
		context.toolbox = props.toolbox;
	});

	watchEffect(() => {
		context.search = props.search;
	});

	watchEffect(() => {
		context.autofocus = props.autofocus;
	});

	watchEffect(() => {
		context.legend = props.legend;
	});

	watchEffect(() => {
		context.interactive = props.interactive;
	});

	watchEffect(() => {
		context.linkLogo = props.linkLogo;
	});

	watchEffect(() => {
		context.updateHash = props.updateHash;
	});

	const isNarrow = computedOnResize(() => window.innerWidth < 768)
	watchEffect(() => {
		context.isNarrow = isNarrow.value;
	});

	watch(() => context.activePadId, () => {
		emit("update:padId", context.activePadId);
	});

	watch(() => context.activePadName, () => {
		emit("update:padName", context.activePadName);
	});
</script>

<template>
	<div class="fm-facilmap">
		<Client>
			<LeafletMap>
				<Toolbox v-if="context.toolbox" :interactive="context.interactive"></Toolbox>
				<!--<Legend v-if="context.legend"></Legend>
				<Import v-if="context.interactive"></Import>
				<ClickMarker></ClickMarker>-->

				<template #before>
					<slot name="before"></slot>
				</template>

				<template #after>
					<!-- <SearchBox></SearchBox> -->
					<slot name="after"></slot>
				</template>

				<slot></slot>
			</LeafletMap>
		</Client>
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