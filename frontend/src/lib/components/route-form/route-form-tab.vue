<script setup lang="ts">
	import RouteForm from "./route-form.vue";
	import type { HashQuery } from "facilmap-leaflet";
	import SearchBoxTab from "../search-box/search-box-tab.vue";
	import { ref } from "vue";
	import { useEventListener } from "../../utils/utils";
	import { injectContextRequired, requireMapContext, requireSearchBoxContext } from "../facil-map-context-provider/facil-map-context-provider.vue";

	const context = injectContextRequired();
	const mapContext = requireMapContext(context);
	const searchBoxContext = requireSearchBoxContext(context);

	const routeForm = ref<InstanceType<typeof RouteForm>>();

	const hashQuery = ref<HashQuery>();

	useEventListener(mapContext, "route-set-query", (data) => {
		routeForm.value!.setQuery(data);
	});
	useEventListener(mapContext, "route-set-from", (data) => {
		routeForm.value!.setFrom(data);
	});
	useEventListener(mapContext, "route-add-via", (data) => {
		routeForm.value!.addVia(data);
	});
	useEventListener(mapContext, "route-set-to", (data) => {
		routeForm.value!.setTo(data);
	});

	function activate(): void {
		searchBoxContext.value.activateTab(`fm${context.id}-route-form-tab`);
	}
</script>

<template>
	<SearchBoxTab
		title="Route"
		:id="`fm${context.id}-route-form-tab`"
		:hashQuery="hashQuery"
		class="fm-route-form-tab"
	>
		<template #default="slotProps">
			<RouteForm :active="slotProps.isActive" @activate="activate()" ref="routeForm" @hash-query-change="hashQuery = $event"></RouteForm>
		</template>
	</SearchBoxTab>
</template>

<style lang="scss">
	.fm-route-form-tab {
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		flex-grow: 1;

		.input-group {
			position: static;
		}
	}
</style>