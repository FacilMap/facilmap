<script setup lang="ts">
	import RouteForm from "./route-form.vue";
	import type { HashQuery } from "facilmap-leaflet";
	import SearchBoxTab from "../search-box/search-box-tab.vue";
	import { computed, readonly, ref, toRef, type DeepReadonly } from "vue";
	import { injectContextRequired, requireSearchBoxContext } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import type { RouteDestination, UseAsType } from "../facil-map-context-provider/route-form-tab-context";
	import { useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const mapContext = toRef(() => context.components.map);
	const searchBoxContext = requireSearchBoxContext(context);
	const i18n = useI18n();

	const routeForm = ref<InstanceType<typeof RouteForm>>();

	const hashQuery = ref<HashQuery>();

	const routeFormTabContext = ref({
		setQuery(query: string, zoom?: boolean, smooth?: boolean) {
			routeForm.value!.setQuery(query, zoom, smooth);
		},

		useAs(destination: DeepReadonly<RouteDestination>, as: UseAsType) {
			routeForm.value!.useAs(destination, as);
		},

		hasFrom: computed(() => routeForm.value?.hasFrom ?? false),
		hasTo: computed(() => routeForm.value?.hasTo ?? false),
		hasVia: computed(() => routeForm.value?.hasVia ?? false)
	});

	context.provideComponent("routeFormTab", toRef(readonly(routeFormTabContext)));

	function activate(): void {
		searchBoxContext.value.activateTab(`fm${context.id}-route-form-tab`, { expand: true });
	}

	function handleHashQueryChange(query: HashQuery | undefined) {
		hashQuery.value = query;

		if (query) {
			mapContext.value?.components.selectionHandler.setSelectedItems([]); // Workaround for now to force route into the hash query
		}
	}
</script>

<template>
	<SearchBoxTab
		:title="i18n.t('route-form-tab.tab-label')"
		:id="`fm${context.id}-route-form-tab`"
		:hashQuery="hashQuery"
		class="fm-route-form-tab"
	>
		<template #default="slotProps">
			<RouteForm :active="slotProps.isActive" @activate="activate()" ref="routeForm" @hash-query-change="handleHashQueryChange($event)"></RouteForm>
		</template>
	</SearchBoxTab>
</template>

<style lang="scss">
	.fm-route-form-tab.fm-route-form-tab.fm-route-form-tab {
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		flex-grow: 1;

		.input-group {
			position: static;
		}
	}
</style>