<script setup lang="ts">
	import RouteForm from "./route-form.vue";
	import type { HashQuery } from "facilmap-leaflet";
	import SearchBoxTab from "../search-box/search-box-tab.vue";
	import { readonly, ref, toRef } from "vue";
	import { injectContextRequired, requireSearchBoxContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import type { WritableRouteFormTabContext } from "../facil-map-context-provider/route-form-tab-context";

	const context = injectContextRequired();
	const searchBoxContext = requireSearchBoxContext(context);

	const routeForm = ref<InstanceType<typeof RouteForm>>();

	const hashQuery = ref<HashQuery>();

	const routeFormTabContext = ref<WritableRouteFormTabContext>({
		setQuery(query, zoom, smooth) {
			routeForm.value!.setQuery(query, zoom, smooth);
		},

		setFrom(destination) {
			routeForm.value!.setFrom(destination);
		},

		addVia(destination) {
			routeForm.value!.addVia(destination);
		},

		setTo(destination) {
			routeForm.value!.setTo(destination);
		}
	});

	context.provideComponent("routeFormTab", toRef(readonly(routeFormTabContext)));

	function activate(): void {
		searchBoxContext.value.activateTab(`fm${context.id}-route-form-tab`, { expand: true });
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