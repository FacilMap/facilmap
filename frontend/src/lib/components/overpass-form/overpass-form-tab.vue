<script setup lang="ts">
	import OverpassForm from "./overpass-form.vue";
	import SearchBoxTab from "../search-box/search-box-tab.vue";
	import { injectContextRequired } from "../facil-map-context-provider/facil-map-context-provider.vue";
	import { useI18n } from "../../utils/i18n";

	const context = injectContextRequired();
	const i18n = useI18n();
</script>

<template>
	<SearchBoxTab
		:title="i18n.t('overpass-form-tab.pois')"
		:id="`fm${context.id}-overpass-form-tab`"
		class="fm-overpass-form-tab"
	>
		<OverpassForm></OverpassForm>
	</SearchBoxTab>
</template>

<style lang="scss">
	.fm-overpass-form-tab.fm-overpass-form-tab.fm-overpass-form-tab {
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
	}
</style>